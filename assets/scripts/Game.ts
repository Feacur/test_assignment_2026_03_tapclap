import { BlockType } from "./BlockType"
import { BlockTypeGenerator } from "./BlockTypeGenerator";
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
	private blocks: BlockType[] = null;
	private moves: number = 0;
	private score: number = 0;

	private input: cc.Vec2 = null;

	constructor(size: cc.Vec2, proxy: GameProxy) {
		this.size.x = size.x;
		this.size.y = size.y;
		this.blocks = new Array(size.x * size.y);
		this.proxy = proxy;
	}

	// API:

	generateBlocks() {
		for (let y = 0; y < this.size.y; y++) {
			for (let x = 0; x < this.size.x; x++) {
				const blockType = BlockTypeGenerator.generate();
				this.setBlockType(x, y, blockType);
			}
		}
	}

	inputTouchBlock(x: number, y: number) {
		if (this.state == GameState.Input)
			this.input = new cc.Vec2(x, y);
	}

	tick(dt: number): void {
		switch (this.state) {
			case GameState.None:    this.doStateNone();    break;
			case GameState.Input:   this.doStateInput();   break;
			case GameState.Process: this.doStateProcess(); break;
			case GameState.Anim:    this.doStateAnim();    break;
		}
	}

	// LOGIC:

	private getBlockType(x: number, y: number): BlockType {
		const ret = this.blocks[this.size.x * y + x];
		return ret;
	}

	private setBlockType(x: number, y: number, blockType: BlockType) {
		this.blocks[this.size.x * y + x] = blockType;
		this.proxy?.setBlockCallback(x, y, blockType);
	}

	private destroySingleBlock(x: number, y: number) {
		this.setBlockType(x, y, BlockType.None);
		this.score += 1;
		this.proxy?.updateScoreCallback(this.score);
		// @todo trigger non-trivial blocks
	}

	private doStateNone() {
		this.state = GameState.Input;
	}

	private doStateInput() {
		if (this.input == null) return;
		this.moves += 1;
		this.state = GameState.Process;
		this.proxy?.updateMovesCallback(this.moves);
	}

	private doStateProcess() {
		this.doProcessBlock(this.input.x, this.input.y);
		this.state = GameState.Anim;
		this.input = null;
	}

	private doStateAnim() {
		this.state = GameState.None;
	}

	// PROCESSING

	private doProcessBlock(x: number, y: number) {
		const blockType = this.getBlockType(this.input.x, this.input.y);
		switch (blockType) {
			case BlockType.Blue:
			case BlockType.Green:
			case BlockType.Purple:
			case BlockType.Red:
			case BlockType.Yellow: {
				this.doProcessFloodFill(x, y, blockType);
			} break;

			case BlockType.BombTiny: {
				const size: number = 1;
				this.doProcessArea(x, y, size);
			} break;

			case BlockType.BombHuge: {
				const size: number = 2;
				this.doProcessArea(x, y, size);
			} break;

			case BlockType.RocketsVertical: {
				for (let itY = 0; itY < this.size.y; itY++) {
					this.destroySingleBlock(x, itY);
				}
			} break;

			case BlockType.RocketsHorizontal: {
				for (let itX = 0; itX < this.size.x; itX++) {
					this.destroySingleBlock(itX, y);
				}
			} break;
		}
	}

	doProcessFloodFill(x: number, y: number, blockType: BlockType) {
		this.destroySingleBlock(x, y);
	}

	doProcessArea(x: number, y: number, size: number) {
		const xMin = Math.max(x - size, 0);
		const xMax = Math.min(x + size, this.size.x  - 1);
		const yMin = Math.max(y - size, 0);
		const yMax = Math.min(y + size, this.size.y - 1);
		for (let itY = yMin; itY <= yMax; itY++) {
			for (let itX = xMin; itX <= xMax; itX++) {
				this.destroySingleBlock(itX, itY);
			}
		}
	}
}
