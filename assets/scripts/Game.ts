import { TileType, TileGenerator, TileUtils, TileValue } from "./Tile"
import { EventType, GameProxy } from "./GameProxy";

enum GameState {
	None = 0,
	ProcessBoard,
	InputQueue,
	ProcessQueue,
	Animate,
}

export class Game {
	private size: cc.Vec2 = new cc.Vec2(0, 0);
	private proxy: GameProxy = null;

	private state: GameState = GameState.None;

	private tiles: TileType[] = null
	private skips: boolean[] = null

	private inits: number = 0;
	private moves: number = 0;
	private score: number = 0;

	private queue: number[] = []
	private queueIndex: number = 0;

	constructor(size: cc.Vec2, proxy: GameProxy) {
		this.size.x = size.x;
		this.size.y = size.y;
		this.proxy = proxy;

		this.tiles = new Array(size.x * size.y);
		this.skips = new Array(size.x * size.y);
	}

	// API:

	reinitTiles(): void {
		this.inits += 1;
		for (let y = 0; y < this.size.y; y++) {
			for (let x = 0; x < this.size.x; x++) {
				const index = this.getIndex(x, y);
				const type = TileGenerator.generate();
				this.tiles[index] = type;
			}
		}

		if (this.proxy != null) {
			for (let index = 0; index < this.tiles.length; index++) {
				const type = this.tiles[index];
				this.proxyUpdateTile(EventType.Init, index, type, index, type);
			}
			this.proxy.updateMoves(this.moves);
			this.proxy.updateScore(this.score);
		}
	}

	inputTouchTile(x: number, y: number): void {
		if (this.state != GameState.InputQueue) return;
		this.queue.length = 0; // @note only a single tile can be triggered by input
		if (x >= 0 && x < this.size.x && y >= 0 && y < this.size.y) {
			const index = this.getIndex(x, y);
			const type = this.tiles[index];
			if (TileUtils.isTouchanble(type))
				this.queue.push(index);
		}
	}

	tick(dt: number): void {
		while (true) {
			const previousState = this.state;
			switch (previousState) {
				case GameState.None:         this.doStateNone();         break;
				case GameState.ProcessBoard: this.doStateProcessBoard(); break;
				case GameState.InputQueue:   this.doStateInputQueue();   break;
				case GameState.ProcessQueue: this.doStateProcessQueue(); break;
				case GameState.Animate:      this.doStateAnimate();      break;
			}
			// @note waiting for input or animating, but processing
			// can be spread thin over a few frames too as an optimization
			if (previousState == this.state) break;
		}
	}

	// LOGIC:

	private doStateNone(): void {
		this.queue.length = 0;
		this.queueIndex = 0;
		this.state = GameState.ProcessBoard;
	}

	private doStateProcessBoard(): void { // @note can be time sliced
		let change = false;

		for (let sourceIdx = this.size.x; sourceIdx < this.tiles.length; sourceIdx++) {
			const targetIdx = sourceIdx  - this.size.x;
			const targetType = this.tiles[targetIdx];
			const sourceType = this.tiles[sourceIdx];
			if (TileUtils.canBeMoveSource(sourceType) && TileUtils.canBeMoveTarget(targetType)) {
				const trailType = TileUtils.getTrailType(sourceType);
				this.tiles[sourceIdx] = trailType;
				this.tiles[targetIdx] = sourceType;
				change = true;
				if (this.proxy != null) {
					this.proxyUpdateTile(EventType.Trail, sourceIdx, sourceType, sourceIdx, trailType);
					this.proxyUpdateTile(EventType.Moved, sourceIdx, targetType, targetIdx, sourceType);
				}
			}
		}

		for (let index = this.tiles.length - this.size.x; index < this.tiles.length; index++) {
			const type = this.tiles[index];
			if (TileUtils.isFillable(type)) {
				const spawnType = TileGenerator.generate();
				this.tiles[index] = spawnType;
				change = true;
				if (this.proxy != null)
					this.proxyUpdateTile(EventType.Spawn, index, type, index, spawnType);
			}
		}

		this.state = change
			? GameState.Animate
			: GameState.InputQueue;
	}

	private doStateInputQueue(): void {
		if (this.queue.length == 0)
			return; // @note idle

		this.preprocessInputQueue();
		if (this.verifyInputQueue()) {
			this.moves += 1;
			if (this.proxy != null)
				this.proxy.updateMoves(this.moves);
			this.state = GameState.ProcessQueue;
		}
		else {
			if (this.proxy != null) {
				let index = this.queue[0];
				const type = this.tiles[index];
				this.proxyUpdateTile(EventType.Error, index, type, index, type);
			}
			this.state = GameState.Animate;
		}
	}

	private doStateProcessQueue(): void {
		// @note processing can be time sliced as an optimization option
		// but only would be sensible for insane synergized combinations
		// say, if something generates new tiles and builds up the queue
		const timeSliceSize = this.size.x * this.size.y * 10;
		const nextTimeSliceIndex = Math.min(this.queueIndex + timeSliceSize, this.queue.length);
		for (/*empty*/; this.queueIndex < nextTimeSliceIndex; this.queueIndex++) {
			const index = this.queue[this.queueIndex];
			const type = this.tiles[index];

			if (TileUtils.isDestructible(type)) {
				const damagedType = TileUtils.getDamagedType(type);

				this.score += TileValue.get(type);
				this.tiles[index] = damagedType;

				if (this.proxy != null)
					this.proxyUpdateTile(EventType.Damage, index, type, index, damagedType);
			}

			const dmgeRadius = TileUtils.getDamageRadius(type);
			switch (type) {
				case TileType.BombTiny:    this.doProcessArea(index, dmgeRadius); break;
				case TileType.BombHuge:    this.doProcessArea(index, dmgeRadius); break;
				case TileType.RocketsVert: this.doProcessVert(index, dmgeRadius); break;
				case TileType.RocketsHori: this.doProcessHori(index, dmgeRadius); break;
			}
		}

		if (this.queueIndex >= this.queue.length)
			this.state = GameState.Animate;
	}

	private doStateAnimate(): void {
		if (this.proxy != null) { // @note idle
			if (this.proxy.waitForAnim()) return;
			this.proxy.updateScore(this.score);
		}
		this.state = GameState.None;
	}

	// QUEUEING:

	private queueSafeOffsetAny(index: number): void {
		if (index < 0) return;
		if (this.skips[index]) return;

		this.skips[index] = true;
		this.queue.push(index);
	}

	private queueSafeOffsetMatching(index: number, matchType: TileType): void {
		if (index < 0) return;
		if (this.skips[index]) return;

		const type = this.tiles[index];
		if (TileUtils.matchFloodFill(type, matchType)) {
			this.skips[index] = true;
			this.queue.push(index);
		}
	}

	// PROCESSING:

	private preprocessInputQueue(): void {
		let index = this.queue[0];
		const type = this.tiles[index];
		
		if (TileUtils.isFloodFillable(type)) {
			this.skips[index] = true;
			for (let nextIt = this.queue.length; /*late check instead*/; nextIt++) {
				this.queueSafeOffsetMatching(this.getOffsetIndex(index, -1,  0), type);
				this.queueSafeOffsetMatching(this.getOffsetIndex(index,  1,  0), type);
				this.queueSafeOffsetMatching(this.getOffsetIndex(index,  0, -1), type);
				this.queueSafeOffsetMatching(this.getOffsetIndex(index,  0,  1), type);
	
				if (nextIt >= this.queue.length) break;
				index = this.queue[nextIt];
			}
			this.resetSkips();
		}
	}

	private verifyInputQueue(): boolean {
		let index = this.queue[0];
		const type = this.tiles[index];
		const minTilesCountForDmge = TileUtils.getMinTilesCountForDmge(type);
		return this.queue.length >= minTilesCountForDmge;
	}

	private doProcessArea(center: number, radius: number): void {
		const xCenter = (center % this.size.x);
		const yCenter = Math.floor(center / this.size.x);

		let index = center;
		this.skips[index] = true;
		for (let nextIt = this.queue.length; /*late check instead*/; nextIt++) {
			const x = (index % this.size.x);
			const y = Math.floor(index / this.size.x);
			if (Math.abs(x - xCenter) < radius && Math.abs(y - yCenter) < radius) {
				this.queueSafeOffsetAny(this.getOffsetIndex(index, -1,  0));
				this.queueSafeOffsetAny(this.getOffsetIndex(index,  1,  0));
				this.queueSafeOffsetAny(this.getOffsetIndex(index,  0, -1));
				this.queueSafeOffsetAny(this.getOffsetIndex(index,  0,  1));

				this.queueSafeOffsetAny(this.getOffsetIndex(index, -1, -1));
				this.queueSafeOffsetAny(this.getOffsetIndex(index,  1, -1));
				this.queueSafeOffsetAny(this.getOffsetIndex(index, -1,  1));
				this.queueSafeOffsetAny(this.getOffsetIndex(index,  1,  1));
			}

			if (nextIt >= this.queue.length) break;
			index = this.queue[nextIt];
		}
		this.resetSkips();
	}

	private doProcessVert(center: number, radius: number): void {
		for (let offset = -radius; offset <= radius; offset++) {
			let index = this.getOffsetIndex(center, offset, 0);
			if (index < 0) continue;
			this.skips[index] = true;
			for (let nextIt = this.queue.length; /*late check instead*/; nextIt++) {
				this.queueSafeOffsetAny(this.getOffsetIndex(index, 0, -1));
				this.queueSafeOffsetAny(this.getOffsetIndex(index, 0,  1));
				
				if (nextIt >= this.queue.length) break;
				index = this.queue[nextIt];
			}
		}
		this.resetSkips();
	}

	private doProcessHori(center: number, radius: number): void {
		for (let offset = -radius; offset <= radius; offset++) {
			let index = this.getOffsetIndex(center, 0, offset);
			if (index < 0) continue;
			this.skips[index] = true;
			for (let nextIt = this.queue.length; /*late check instead*/; nextIt++) {
				this.queueSafeOffsetAny(this.getOffsetIndex(index, -1, 0));
				this.queueSafeOffsetAny(this.getOffsetIndex(index,  1, 0));
				
				if (nextIt >= this.queue.length) break;
				index = this.queue[nextIt];
			}
		}
		this.resetSkips();
	}

	// HELPERS:

	private getIndex(x: number, y: number): number {
		const ret = y * this.size.x + x;
		return ret;
	}

	private getOffsetIndex(center: number, xOffset: number, yOffset: number): number {
		const x = (center % this.size.x)           + xOffset;
		const y = Math.floor(center / this.size.x) + yOffset;

		if (x <  0)           return -1;
		if (x >= this.size.x) return -1;
		if (y <  0)           return -1;
		if (y >= this.size.y) return -1;

		const ret = this.getIndex(x, y);
		return ret;
	}

	private resetSkips(): void {
		for (let i = 0; i < this.skips.length; i++)
			this.skips[i] = false;
	}

	private proxyUpdateTile(eventType: EventType,
		sourceIndex: number, sourceType: TileType,
		targetIndex: number, targetType: TileType
	): void {
		const sourceX = sourceIndex % this.size.x;
		const sourceY = Math.floor(sourceIndex / this.size.x);
		const targetX = targetIndex % this.size.x;
		const targetY = Math.floor(targetIndex / this.size.x);
		this.proxy.updateTile(eventType,
			sourceX, sourceY, sourceType,
			targetX, targetY, targetType
		);
	}
}
