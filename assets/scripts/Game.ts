import { BlockType, BlockTypeGenerator, BlockTypeUtils, BlockTypeValue } from "./BlockType"
import { EventType, GameProxy } from "./GameProxy";

enum GameState {
	None = 0,
	Fill,
	Input,
	Process,
	Anim,
}

export class Game {
	private size: cc.Vec2 = new cc.Vec2(0, 0);
	private proxy: GameProxy = null;

	private state: GameState = GameState.None;

	private blocks: BlockType[] = null
	private skips: boolean[] = null

	private inits: number = 0;
	private moves: number = 0;
	private score: number = 0;

	private queue: number[] = []

	constructor(size: cc.Vec2, proxy: GameProxy) {
		this.size.x = size.x;
		this.size.y = size.y;
		this.proxy = proxy;

		this.blocks = new Array(size.x * size.y);
		this.skips = new Array(size.x * size.y);
	}

	// API:

	reinitBlocks(): void {
		this.inits += 1;
		for (let y = 0; y < this.size.y; y++) {
			for (let x = 0; x < this.size.x; x++) {
				const index = this.getIndex(x, y);
				const blockType = BlockTypeGenerator.generate();
				this.blocks[index] = blockType;
			}
		}

		if (this.proxy != null) {
			for (let index = 0; index < this.blocks.length; index++) {
				const blockType = this.blocks[index];
				this.proxyUpdateBlock(EventType.Init, index, blockType, index, blockType);
			}
			this.proxy.updateMoves(this.moves);
			this.proxy.updateScore(this.score);
		}
	}

	inputTouchBlock(x: number, y: number): void {
		if (this.state != GameState.Input) return;
		this.queue.length = 0; // @note only a single block can be triggered by input
		if (x >= 0 && x < this.size.x && y >= 0 && y < this.size.y) {
			const index = this.getIndex(x, y);
			const blockType = this.blocks[index];
			if (BlockTypeUtils.isTouchanble(blockType))
				this.queue.push(index);
		}
	}

	tick(dt: number): void {
		while (true) {
			const previousState = this.state;
			switch (previousState) {
				case GameState.None:    this.doStateNone();    break;
				case GameState.Fill:    this.doStateFill();    break;
				case GameState.Input:   this.doStateInput();   break;
				case GameState.Process: this.doStateProcess(); break;
				case GameState.Anim:    this.doStateAnim();    break;
			}
			// @note waiting for input or animating, but processing
			// can be spread thin over a few frames too as an optimization
			if (previousState == this.state) break;
		}
	}

	// LOGIC:

	private doStateNone(): void {
		this.queue.length = 0;
		this.state = GameState.Fill;
	}

	private doStateFill(): void {
		let change = false;

		for (let sourceIdx = this.size.x; sourceIdx < this.blocks.length; sourceIdx++) {
			const targetIdx = sourceIdx  - this.size.x;
			const targetType = this.blocks[targetIdx];
			const sourceType = this.blocks[sourceIdx];
			if (BlockTypeUtils.canBeMoveSource(sourceType) && BlockTypeUtils.canBeMoveTarget(targetType)) {
				const moveTrailType = BlockTypeUtils.getMoveTrailType(sourceType);
				this.blocks[targetIdx] = sourceType;
				this.blocks[sourceIdx] = moveTrailType;
				change = true;
				if (this.proxy != null) {
					this.proxyUpdateBlock(EventType.Move, sourceIdx, targetType, targetIdx, sourceType);
					this.proxyUpdateBlock(EventType.Yank, sourceIdx, sourceType, sourceIdx, moveTrailType);
				}
			}
		}

		for (let index = this.blocks.length - this.size.x; index < this.blocks.length; index++) {
			const blockType = this.blocks[index];
			if (BlockTypeUtils.isFillable(blockType)) {
				const nextBlockType = BlockTypeGenerator.generate();
				this.blocks[index] = nextBlockType;
				change = true;
				if (this.proxy != null)
					this.proxyUpdateBlock(EventType.Fill, index, blockType, index, nextBlockType);
			}
		}

		this.state = change
			? GameState.Anim
			: GameState.Input;
	}

	private doStateInput(): void {
		if (this.queue.length == 0)
			return; // @note idle

		this.preprocessInputQueue();
		if (this.verifyInputQueue()) {
			this.moves += 1;
			if (this.proxy != null)
				this.proxy.updateMoves(this.moves);
			this.state = GameState.Process;
		}
		else {
			if (this.proxy != null) {
				let index = this.queue[0];
				const blockType = this.blocks[index];
				this.proxyUpdateBlock(EventType.Errr, index, blockType, index, blockType);
			}
			this.state = GameState.Anim;
		}
	}

	private doStateProcess(): void {
		for (let it = 0; it < this.queue.length; it++) {
			const index = this.queue[it];
			const blockType = this.blocks[index];

			if (BlockTypeUtils.isDestructible(blockType)) {
				const wipeTrailType = BlockTypeUtils.getWipeTrailType(blockType);

				this.score += BlockTypeValue.get(blockType);
				this.blocks[index] = wipeTrailType;

				if (this.proxy != null)
					this.proxyUpdateBlock(EventType.Wipe, index, blockType, index, wipeTrailType);
			}

			switch (blockType) {
				case BlockType.BombTiny:          this.doProcessArea(index, BlockTypeUtils.getWipeRadius(blockType)); break;
				case BlockType.BombHuge:          this.doProcessArea(index, BlockTypeUtils.getWipeRadius(blockType)); break;
				case BlockType.RocketsVertical:   this.doProcessVertical(index);                                      break;
				case BlockType.RocketsHorizontal: this.doProcessHorizontal(index);                                    break;
			}
		}

		this.state = GameState.Anim;
	}

	private doStateAnim(): void {
		if (this.proxy != null) { // @note idle
			if (this.proxy.waitForAnim()) return;
			this.proxy.updateScore(this.score);
		}
		this.state = GameState.None;
	}

	// QUEUEING:

	private queueOffsetAny(center: number, xOffset: number, yOffset: number): void {
		const x = (center % this.size.x)           + xOffset;
		const y = Math.floor(center / this.size.x) + yOffset;

		if (x <  0)           return;
		if (x >= this.size.x) return;
		if (y <  0)           return;
		if (y >= this.size.y) return;

		const index = this.getIndex(x, y);
		if (this.skips[index]) return;

		this.skips[index] = true;
		this.queue.push(index);
	}

	private queueOffsetMatching(center: number, xOffset: number, yOffset: number, matchBlockType: BlockType): void {
		const x = (center % this.size.x)           + xOffset;
		const y = Math.floor(center / this.size.x) + yOffset;

		if (x <  0)           return;
		if (x >= this.size.x) return;
		if (y <  0)           return;
		if (y >= this.size.y) return;

		const index = this.getIndex(x, y);
		if (this.skips[index]) return;

		const blockType = this.blocks[index];
		if (BlockTypeUtils.matchFloodFill(blockType, matchBlockType)) {
			this.skips[index] = true;
			this.queue.push(index);
		}
	}

	// PROCESSING:

	private preprocessInputQueue(): void {
		let index = this.queue[0];
		const blockType = this.blocks[index];
		
		if (BlockTypeUtils.isFloodFillable(blockType)) {
			this.skips[index] = true;
			for (let nextIt = this.queue.length; /*late check instead*/; nextIt++) {
				this.queueOffsetMatching(index, -1,  0, blockType);
				this.queueOffsetMatching(index,  1,  0, blockType);
				this.queueOffsetMatching(index,  0, -1, blockType);
				this.queueOffsetMatching(index,  0,  1, blockType);
	
				if (nextIt >= this.queue.length) break;
				index = this.queue[nextIt];
			}
			this.resetSkips();
		}
	}

	private verifyInputQueue(): boolean {
		let index = this.queue[0];
		const blockType = this.blocks[index];
		const minBlocksCountForWipe = BlockTypeUtils.getMinBlocksCountForWipe(blockType);
		return this.queue.length >= minBlocksCountForWipe;
	}

	private doProcessArea(center: number, radius: number): void {
		const xCenter = (center % this.size.x);
		const yCenter = Math.floor(center / this.size.x);

		let index = center;
		this.skips[center] = true;
		for (let nextIt = this.queue.length; /*late check instead*/; nextIt++) {
			const x = (index % this.size.x);
			const y = Math.floor(index / this.size.x);
			if (Math.abs(x - xCenter) < radius && Math.abs(y - yCenter) < radius) {
				this.queueOffsetAny(index, -1,  0);
				this.queueOffsetAny(index,  1,  0);
				this.queueOffsetAny(index,  0, -1);
				this.queueOffsetAny(index,  0,  1);

				this.queueOffsetAny(index, -1, -1);
				this.queueOffsetAny(index,  1, -1);
				this.queueOffsetAny(index, -1,  1);
				this.queueOffsetAny(index,  1,  1);
			}

			if (nextIt >= this.queue.length) break;
			index = this.queue[nextIt];
		}
		this.resetSkips();
	}

	private doProcessVertical(center: number): void {
		let index = center;
		this.skips[center] = true;
		for (let nextIt = this.queue.length; /*late check instead*/; nextIt++) {
			this.queueOffsetAny(index, 0, -1);
			this.queueOffsetAny(index, 0,  1);

			if (nextIt >= this.queue.length) break;
			index = this.queue[nextIt];
		}
		this.resetSkips();
	}

	private doProcessHorizontal(center: number): void {
		let index = center;
		this.skips[center] = true;
		for (let nextIt = this.queue.length; /*late check instead*/; nextIt++) {
			this.queueOffsetAny(index, -1, 0);
			this.queueOffsetAny(index,  1, 0);

			if (nextIt >= this.queue.length) break;
			index = this.queue[nextIt];
		}
		this.resetSkips();
	}

	// HELPERS:

	private getIndex(x: number, y: number): number {
		const ret = y * this.size.x + x;
		return ret;
	}

	private resetSkips(): void {
		for (let i = 0; i < this.skips.length; i++)
			this.skips[i] = false;
	}

	private proxyUpdateBlock(eventType: EventType,
		sourceIndex: number, sourceType: BlockType,
		targetIndex: number, targetType: BlockType
	): void {
		const sourceX = sourceIndex % this.size.x;
		const sourceY = Math.floor(sourceIndex / this.size.x);
		const targetX = targetIndex % this.size.x;
		const targetY = Math.floor(targetIndex / this.size.x);
		this.proxy.updateBlock(eventType,
			sourceX, sourceY, sourceType,
			targetX, targetY, targetType
		);
	}
}
