import { TileType, TileGenerator, TileUtils, TileValue } from "./Tile"
import { TileEvent, GameProxy, StateEvent } from "./GameProxy";

enum GameState {
	None = 0,
	ProcessBoard,
	InputQueue,
	ProcessQueue,
	WaitAnimation,
	Stuck,
	Lost,
	Won,
}

export enum BoostType {
	None = 0,
	Tele,
	Bomb,
	__COUNT__,
}

export class GameSettings {
	size: cc.Vec2 = new cc.Vec2(0, 0);
	regenLimit: number = 0;
	movesLimit: number = 0;
	scoreLimit: number = 0;
	boostLimit: number[] = new Array(BoostType.__COUNT__);

	set(other: GameSettings): void {
		this.size.x = other.size.x;
		this.size.y = other.size.y;
		this.regenLimit = other.regenLimit;
		this.movesLimit = other.movesLimit;
		this.scoreLimit = other.scoreLimit;
		for (let it = 0; it < this.boostLimit.length; it++) {
			const otherValue = other.boostLimit[it];
			this.boostLimit[it] = otherValue;
		}
	}
}

export class Game {
	private proxy: GameProxy = null;
	private settings: GameSettings = new GameSettings();

	// persistent
	private tiles: TileType[] = []
	private state: GameState = GameState.None;
	private regen: number = 0;
	private moves: number = 0;
	private score: number = 0;
	private boost: number[] = new Array(BoostType.__COUNT__);

	// transient
	private skips: boolean[] = []
	private queue: number[] = []
	private queueIndex: number = 0;

	constructor(proxy: GameProxy) {
		this.proxy = proxy;

	}

	// API:

	initialize(settings: GameSettings): void {
		this.settings.set(settings);

		const boardTilesCount = settings.size.x * settings.size.y;
		if (this.tiles.length != boardTilesCount)
			this.tiles.length = boardTilesCount;
		if (this.skips.length != boardTilesCount)
			this.skips.length = boardTilesCount;

		this.regen = 0;
		this.moves = 0;
		this.score = 0;
		for (let type = 0; type < this.boost.length; type++)
			this.boost[type] = 0;

		this.regenerateTiles();
		if (this.proxy != null) {
			this.proxy.updateMoves(this.moves);
			this.proxy.updateScore(this.score);
			this.proxy.updateState(StateEvent.None);
			for (let type = 0; type < this.boost.length; type++) {
				const available = this.getAvailableBoosts(type);
				this.proxy.updateBoost(type, available);
			}
		}
	}

	inputShuffle(): boolean {
		if (this.state == GameState.Stuck) {
			this.regenerateTiles();
			if (this.proxy != null)
				this.proxy.updateState(StateEvent.None);
			return true;
		}
		return false;
	}

	inputTouchTile(x: number, y: number): boolean {
		if (x < 0 || x >= this.settings.size.x || y < 0 || y >= this.settings.size.y)
			return false; // OOB

		const index = this.getIndex(x, y);
		const type = this.tiles[index];

		if (this.state == GameState.InputQueue) {
			this.queue.length = 0; // @note only a single tile can be triggered by input
			if (TileUtils.isTouchanble(type)) {
				this.queue.push(index);
				return true; // input has been recorded for later
			}
		}

		return false;
	}

	inputBoost(type: BoostType,
		sourceX: number, sourceY: number,
		targetX: number, targetY: number
	): boolean {
		if (sourceX < 0 || sourceX >= this.settings.size.x || sourceY < 0 || sourceY >= this.settings.size.y)
			return false; // OOB
		if (targetX < 0 || targetX >= this.settings.size.x || targetY < 0 || targetY >= this.settings.size.y)
			return false; // OOB

		const available = this.getAvailableBoosts(type);
		if (available <= 0) return false;

		this.boost[type] += 1;
		if (this.proxy != null)
			this.proxy.updateBoost(type, available - 1);

		const sourceIdx = this.getIndex(sourceX, sourceY);
		const targetIdx = this.getIndex(targetX, targetY);
		const sourceType = this.tiles[sourceIdx];
		const targetType = this.tiles[targetIdx];

		if (this.state == GameState.InputQueue) {
			switch (type) {
				case BoostType.Tele: {
					const isValid = TileUtils.canBeTeleported(sourceType)
					/**/         && TileUtils.canBeTeleported(targetType);
					if (isValid) {
						this.tiles[sourceIdx] = targetType;
						this.tiles[targetIdx] = sourceType;
						// @idea for purposes of VFX this might be a special case, which would mean additional coupling
						// albeit quite minimal. need to ponder a bit more on that... ok as is for now
						this.proxyUpdateTile(TileEvent.Moved, targetIdx, sourceType, sourceIdx, targetType);
						this.proxyUpdateTile(TileEvent.Moved, sourceIdx, targetType, targetIdx, sourceType);
						this.queue.length = 0; this.state = GameState.WaitAnimation; return true; // input has been applied
					}
				} break;
		
				case BoostType.Bomb: {
					const isValid = TileUtils.isDestructible(targetType);
					if (isValid) {
						const radius = 2;
						this.queue.push(targetIdx);
						this.enqueueArea(targetIdx, radius);
						this.state = GameState.ProcessQueue; return true; // input has been recorded for later
					}
				} break;
			}
		}

		return false;
	}

	tick(dt: number): void {
		while (true) {
			const previousState = this.state;
			switch (previousState) {
				case GameState.None:          this.doStateNone();         break;
				case GameState.ProcessBoard:  this.doStateProcessBoard(); break;
				case GameState.InputQueue:    this.doStateInputQueue();   break;
				case GameState.ProcessQueue:  this.doStateProcessQueue(); break;
				case GameState.WaitAnimation: this.doStateAnimate();      break;
			}

			// @note waiting for input or animating, but processing
			// can be spread thin over a few frames too as an optimization
			if (previousState == this.state) break;

			if (this.proxy != null) {
				switch (this.state) {
					case GameState.None:  this.proxy.updateState(StateEvent.None);  break;
					case GameState.Stuck: this.proxy.updateState(StateEvent.Stuck); break;
					case GameState.Lost:  this.proxy.updateState(StateEvent.Lost);  break;
					case GameState.Won:   this.proxy.updateState(StateEvent.Won);   break;
				}
			}
		}
	}

	// LOGIC:

	regenerateTiles(): void {
		const eventType = this.regen == 0
			? TileEvent.Initialize
			: TileEvent.Shuffle;

		this.regen += 1;
		for (let index = 0; index < this.tiles.length; index++) {
			const sourceType = this.tiles[index];
			const regenType = TileGenerator.generate();
			this.tiles[index] = regenType;
			this.proxyUpdateTile(eventType, index, sourceType, index, regenType);
		}
		this.state = GameState.WaitAnimation; // wait for shuffle animation
	}

	private doStateNone(): void {
		this.queue.length = 0;
		this.queueIndex = 0;

		if (this.score >= this.settings.scoreLimit) {
			this.state = GameState.Won;
			return;
		}

		if (this.moves >= this.settings.movesLimit) {
			this.state = GameState.Lost;
			return;
		}

		const preprocessResult = this.preprocessBoard();
		this.state = preprocessResult
			? GameState.ProcessBoard
			: this.regen <= this.settings.regenLimit
				? GameState.Stuck
				: GameState.Lost
			;
	}

	private doStateProcessBoard(): void { // @note can be time sliced
		let change = false;

		for (let sourceIdx = this.settings.size.x; sourceIdx < this.tiles.length; sourceIdx++) {
			const targetIdx = sourceIdx  - this.settings.size.x;
			const targetType = this.tiles[targetIdx];
			const sourceType = this.tiles[sourceIdx];
			if (TileUtils.canBeMoveSource(sourceType) && TileUtils.canBeMoveTarget(targetType)) {
				const trailType = TileUtils.getTrailType(sourceType);
				this.tiles[sourceIdx] = trailType;
				this.tiles[targetIdx] = sourceType;
				this.proxyUpdateTile(TileEvent.Trail, sourceIdx, sourceType, sourceIdx, trailType);
				this.proxyUpdateTile(TileEvent.Moved, sourceIdx, targetType, targetIdx, sourceType);
				change = true;
			}
		}

		for (let index = this.tiles.length - this.settings.size.x; index < this.tiles.length; index++) {
			const type = this.tiles[index];
			if (TileUtils.isFillable(type)) {
				const spawnType = TileGenerator.generate();
				this.tiles[index] = spawnType;
				this.proxyUpdateTile(TileEvent.Spawn, index, type, index, spawnType);
				change = true;
			}
		}

		this.state = change
			? GameState.WaitAnimation
			: GameState.InputQueue;
	}

	private doStateInputQueue(): void {
		if (this.queue.length == 0)
			return; // @note idle

		const preprocessResult = this.preprocessInputQueue();
		if (preprocessResult) {
			this.moves += 1;
			if (this.proxy != null)
				this.proxy.updateMoves(this.moves);
			this.state = GameState.ProcessQueue;
		}
		else {
			this.state = GameState.WaitAnimation;
		}
	}

	private doStateProcessQueue(): void {
		// @note processing can be time sliced as an optimization option
		// but only would be sensible for insane synergized combinations
		// say, if something generates new tiles and builds up the queue
		const timeSliceSize = this.settings.size.x * this.settings.size.y * 10;
		const nextTimeSliceIndex = Math.min(this.queueIndex + timeSliceSize, this.queue.length);
		for (/*empty*/; this.queueIndex < nextTimeSliceIndex; this.queueIndex++) {
			const index = this.queue[this.queueIndex];
			const type = this.tiles[index];

			if (TileUtils.isDestructible(type)) {
				const damagedType = TileUtils.getDamagedType(type);
				this.score += TileValue.get(type);
				this.tiles[index] = damagedType;
				this.proxyUpdateTile(TileEvent.Damage, index, type, index, damagedType);
			}

			const dmgeRadius = TileUtils.getDamageRadius(type);
			switch (type) {
				case TileType.BombTiny:    this.enqueueArea(index, dmgeRadius); break;
				case TileType.BombHuge:    this.enqueueArea(index, dmgeRadius); break;
				case TileType.RocketsVert: this.enqueueVert(index, dmgeRadius); break;
				case TileType.RocketsHori: this.enqueueHori(index, dmgeRadius); break;
			}
		}

		if (this.queueIndex >= this.queue.length)
			this.state = GameState.WaitAnimation;
	}

	private doStateAnimate(): void {
		if (this.proxy != null) { // @note idle
			if (this.proxy.waitForAnim()) return;
			this.proxy.updateScore(this.score);
		}
		this.state = GameState.None;
	}

	// PROCESSING:

	private resetSkips(): void {
		for (let i = 0; i < this.skips.length; i++)
			this.skips[i] = false;
	}

	private enqueueTileAny(index: number): void {
		if (index < 0) return;
		if (this.skips[index]) return;

		this.skips[index] = true;
		this.queue.push(index);
	}

	private enqueueTileMatching(index: number, matchType: TileType): void {
		if (index < 0) return;
		if (this.skips[index]) return;

		const type = this.tiles[index];
		if (TileUtils.matchFloodFill(type, matchType)) {
			this.skips[index] = true;
			this.queue.push(index);
		}
	}

	private enqueueFloodFill(index: number): number {
		if (this.skips[index]) return 0;
		this.skips[index] = true;

		const type = this.tiles[index];
		if (!TileUtils.isFloodFillable(type))
			return 1; // only the tile itself

		const prevLength = this.queue.length;
		for (let nextIt = this.queue.length; /*late check instead*/; nextIt++) {
			this.enqueueTileMatching(this.getOffsetIndex(index, -1,  0), type);
			this.enqueueTileMatching(this.getOffsetIndex(index,  1,  0), type);
			this.enqueueTileMatching(this.getOffsetIndex(index,  0, -1), type);
			this.enqueueTileMatching(this.getOffsetIndex(index,  0,  1), type);

			if (nextIt >= this.queue.length) break;
			index = this.queue[nextIt];
		}

		// @note including this tile
		return 1 + this.queue.length - prevLength;
	}

	private enqueueArea(center: number, radius: number): void {
		const xCenter = (center % this.settings.size.x);
		const yCenter = Math.floor(center / this.settings.size.x);

		let index = center;
		this.skips[index] = true;
		for (let nextIt = this.queue.length; /*late check instead*/; nextIt++) {
			const x = (index % this.settings.size.x);
			const y = Math.floor(index / this.settings.size.x);
			if (Math.abs(x - xCenter) < radius && Math.abs(y - yCenter) < radius) {
				this.enqueueTileAny(this.getOffsetIndex(index, -1,  0));
				this.enqueueTileAny(this.getOffsetIndex(index,  1,  0));
				this.enqueueTileAny(this.getOffsetIndex(index,  0, -1));
				this.enqueueTileAny(this.getOffsetIndex(index,  0,  1));

				this.enqueueTileAny(this.getOffsetIndex(index, -1, -1));
				this.enqueueTileAny(this.getOffsetIndex(index,  1, -1));
				this.enqueueTileAny(this.getOffsetIndex(index, -1,  1));
				this.enqueueTileAny(this.getOffsetIndex(index,  1,  1));
			}

			if (nextIt >= this.queue.length) break;
			index = this.queue[nextIt];
		}
		this.resetSkips();
	}

	private enqueueVert(center: number, radius: number): void {
		for (let offset = -radius; offset <= radius; offset++) {
			let index = this.getOffsetIndex(center, offset, 0);
			if (index < 0) continue;
			this.skips[index] = true;
			for (let nextIt = this.queue.length; /*late check instead*/; nextIt++) {
				this.enqueueTileAny(this.getOffsetIndex(index, 0, -1));
				this.enqueueTileAny(this.getOffsetIndex(index, 0,  1));
				
				if (nextIt >= this.queue.length) break;
				index = this.queue[nextIt];
			}
		}
		this.resetSkips();
	}

	private enqueueHori(center: number, radius: number): void {
		for (let offset = -radius; offset <= radius; offset++) {
			let index = this.getOffsetIndex(center, 0, offset);
			if (index < 0) continue;
			this.skips[index] = true;
			for (let nextIt = this.queue.length; /*late check instead*/; nextIt++) {
				this.enqueueTileAny(this.getOffsetIndex(index, -1, 0));
				this.enqueueTileAny(this.getOffsetIndex(index,  1, 0));
				
				if (nextIt >= this.queue.length) break;
				index = this.queue[nextIt];
			}
		}
		this.resetSkips();
	}

	private preprocessBoard(): boolean {
		let foundMinArea = false;
		for (let index = 0; index < this.tiles.length; index++) {
			this.queue.push(index);
			const area = this.enqueueFloodFill(index);
			this.queue.length = 0;

			const type = this.tiles[index];
			const minArea = TileUtils.getMinAreaToDamage(type);
			if (area >= minArea) {
				foundMinArea = true;
				break;
			}
		}
		this.resetSkips();
		if (foundMinArea) return true;

		return false;
	}

	private preprocessInputQueue(): boolean {
		const index = this.queue[0];
		const area = this.enqueueFloodFill(index);
		const type = this.tiles[index];
		const minArea = TileUtils.getMinAreaToDamage(type);
		this.resetSkips();
		return area >= minArea;
	}

	// HELPERS:

	private getIndex(x: number, y: number): number {
		return y * this.settings.size.x + x;
	}

	private getOffsetIndex(center: number, xOffset: number, yOffset: number): number {
		const x = (center % this.settings.size.x)           + xOffset;
		const y = Math.floor(center / this.settings.size.x) + yOffset;

		if (x <  0)           return -1;
		if (x >= this.settings.size.x) return -1;
		if (y <  0)           return -1;
		if (y >= this.settings.size.y) return -1;

		return this.getIndex(x, y);
	}

	private getAvailableBoosts(type: BoostType) {
		const used = this.boost[type];
		const limit = this.settings.boostLimit[type];
		return limit - used;
	}

	private proxyUpdateTile(eventType: TileEvent,
		sourceIndex: number, sourceType: TileType,
		targetIndex: number, targetType: TileType
	): void {
		if (this.proxy == null) return;
		const sourceX = sourceIndex % this.settings.size.x;
		const sourceY = Math.floor(sourceIndex / this.settings.size.x);
		const targetX = targetIndex % this.settings.size.x;
		const targetY = Math.floor(targetIndex / this.settings.size.x);
		this.proxy.updateTile(eventType,
			sourceX, sourceY, sourceType,
			targetX, targetY, targetType
		);
	}
}
