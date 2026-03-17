import { BlockType, BlockTypeGenerator, BlockTypeUtils, BlockTypeValue } from "./BlockType"
import { GameProxy } from "./GameProxy";

enum GameState {
	None = 0,
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

	generateBlocks(): void {
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
				this.proxyUpdateBlock(index, blockType, blockType);
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
			if (blockType != BlockType.None)
				this.queue.push(index);
		}
	}

	tick(dt: number): void {
		while (true) {
			const previousState = this.state;
			switch (previousState) {
				case GameState.None:    this.doStateNone();    break;
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
		this.state = GameState.Input;
	}

	private doStateInput(): void {
		if (this.queue.length == 0) return;
		this.moves += 1;
		this.proxy?.updateMoves(this.moves);
		this.state = GameState.Process;
	}

	private doStateProcess(): void {
		this.doProcessBuildInitialQueue();

		for (let it = 0; it < this.queue.length; it++) {
			const index = this.queue[it];
			const blockType = this.blocks[index];

			if (BlockTypeUtils.isDestructible(blockType)) {
				const nextBlockType = BlockType.None;

				this.score += BlockTypeValue.get(blockType);
				this.blocks[index] = nextBlockType;

				if (this.proxy != null)
					this.proxyUpdateBlock(index, blockType, nextBlockType);
			}

			switch (blockType) {
				case BlockType.BombTiny: {
					const radius: number = 1;
					this.doProcessArea(index, radius);
				} break;
	
				case BlockType.BombHuge: {
					const radius: number = 2;
					this.doProcessArea(index, radius);
				} break;
	
				case BlockType.RocketsVertical: {
					this.doProcessVertical(index);
				} break;
	
				case BlockType.RocketsHorizontal: {
					this.doProcessHorizontal(index);
				} break;
			}
		}

		this.state = GameState.Anim;
	}

	private doStateAnim(): void {
		if (this.proxy?.waitForAnim()) return;
		this.proxy?.updateScore(this.score);
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
		if (BlockTypeUtils.match(blockType, matchBlockType)) {
			this.skips[index] = true;
			this.queue.push(index);
		}
	}

	// PROCESSING:

	private doProcessBuildInitialQueue(): void {
		let index = this.queue[0];
		const blockType = this.blocks[index];
		if (!BlockTypeUtils.isFloodFillable(blockType)) return;

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

	private proxyUpdateBlock(index: number, prev: BlockType, next: BlockType): void {
		const x = index % this.size.x;
		const y = Math.floor(index / this.size.x);
		this.proxy.updateBlock(x, y, prev, next);
	}
}
