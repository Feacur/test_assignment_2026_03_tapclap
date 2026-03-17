// Learn TypeScript:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/typescript.html
// Learn Attribute:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/reference/attributes.html
// Learn life-cycle s:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/life-cycle-s.html

import { BlockType } from "./BlockType";
import { Game } from "./Game";
import { EventType, GameProxy } from "./GameProxy";

const {ccclass, property} = cc._decorator;

@ccclass
export default class EntryPoint extends cc.Component {

	@property(cc.Label)
	moves: cc.Label = null;

	@property(cc.Label)
	score: cc.Label = null;

	@property(cc.Button)
	boosterTeleButton: cc.Button = null;

	@property(cc.Label)
	boosterTeleLabel: cc.Label = null;

	@property(cc.Button)
	boosterBombButton: cc.Button = null;

	@property(cc.Label)
	boosterBombLabel: cc.Label = null;

	@property(cc.Layout)
	grid: cc.Layout = null;

	@property(cc.Prefab)
	gridPrefab: cc.Prefab = null;

	@property(cc.SpriteFrame)
	blockSpriteFrames: cc.SpriteFrame[] = new Array(BlockType.__COUNT__);

	@property(cc.Vec2)
	gridSize: cc.Vec2 = new cc.Vec2(5, 5);

	private gameProxy: GameProxy = null;
	private blocks: cc.Node[] = null;
	private game: Game = null;

	// LIFE-CYCLE:

	onLoad(): void {
		this.grid.node.on(cc.Node.EventType.TOUCH_START, this.onTouchStart, this, true);

		const boosterTeleEventHandler = new cc.Component.EventHandler();
		boosterTeleEventHandler.target = this.node;
		boosterTeleEventHandler.component = EntryPoint.name;
		boosterTeleEventHandler.handler = "boosterTeleOnClick";
		this.boosterTeleButton.clickEvents.push(boosterTeleEventHandler);

		const boosterBombEventHandler = new cc.Component.EventHandler();
		boosterBombEventHandler.target = this.node;
		boosterBombEventHandler.component = EntryPoint.name;
		boosterBombEventHandler.handler = "boosterBombOnClick";
		this.boosterBombButton.clickEvents.push(boosterBombEventHandler);

		this.grid.enabled = false;
		if (this.blockSpriteFrames.length != BlockType.__COUNT__) {
			this.blockSpriteFrames.length = BlockType.__COUNT__;
			console.log("[warn] `blockSpriteFrames` length reset to %d", BlockType.__COUNT__);
		}

		this.gridSize.x = Math.floor(this.gridSize.x);
		this.gridSize.y = Math.floor(this.gridSize.y);
		if (this.gridSize.x > 9) this.gridSize.x = 9;
		if (this.gridSize.y > 9) this.gridSize.y = 9;

		this.gameProxy = new GameProxy();
		this.gameProxy.updateBlock = (x: number, y: number, blockType: BlockType, eventType: EventType) => {
			this.updateBlock(x, y, blockType);
		}
		this.gameProxy.updateMoves = (value: number): void => { this.updateMoves(value); }
		this.gameProxy.updateScore = (value: number): void => { this.updateScore(value); }
		this.gameProxy.waitForAnim = (): boolean => {
			return false;
		}
	}

	start(): void {
		this.grid.node.width = this.gridSize.x * this.getCellWidth() + (this.grid.paddingLeft + this.grid.paddingRight);
		this.grid.node.height = this.gridSize.y * this.getCellHeight() + (this.grid.paddingBottom + this.grid.paddingTop);
		this.initializeGame();
	}

	update(dt: number): void {
		this.game.tick(dt);
	}

	// INPUT:

	private onTouchStart(event: cc.Event.EventTouch): void {
		const pos = event.touch.getLocation();
		// @fixme dunno how to properly get local position
		// position is a vector offset to the anchor
		// * parent is canvas, anchor is in the center
		// * grid is its child, anchor is its bottom left corner
		// all in all the following sum gives the bottom left grid corner
		// relative to the bottom left canvas corner
		const baseX = this.grid.node.parent.position.x + this.grid.node.position.x + this.grid.paddingLeft;
		const baseY = this.grid.node.parent.position.y + this.grid.node.position.y + this.grid.paddingBottom;
		const x = Math.floor((pos.x - baseX) / this.getCellWidth());
		const y = Math.floor((pos.y - baseY) / this.getCellHeight());
		if (x >= 0 && x < this.gridSize.x && y >= 0 && y < this.gridSize.y)
			this.game.inputTouchBlock(x, y);
	}

	private boosterTeleOnClick (event: Event, customEventData: string): void {
		console.log("clicked booster tele");
	}
	
	private boosterBombOnClick (event: Event, customEventData: string): void {
		console.log("clicked booster bomb");
	}

	// LOGIC:

	private initializeGame (): void {
		// @todo reuse blocks on reinit or at least despawn them
		this.blocks = new Array(this.gridSize.x * this.gridSize.y);
		for (let y = 0; y < this.gridSize.y; y++) {
			for (let x = 0; x < this.gridSize.x; x++) {
				const instance = cc.instantiate(this.gridPrefab);
				const index = this.getIndex(x, y);
				this.blocks[index] = instance;
			}
		}

		for (let y = 0; y < this.gridSize.y; y++) {
			for (let x = 0; x < this.gridSize.x; x++) {
				const index = this.getIndex(x, y);
				let instance = this.blocks[index];
				instance.parent = this.grid.node;
				instance.setPosition(
					x * this.getCellWidth() + this.grid.paddingLeft,
					y * this.getCellHeight() + this.grid.paddingBottom
				);
			}
		}

		this.game = new Game(this.gridSize, this.gameProxy);
		this.game.reinitBlocks();
	}

	private updateBlock (x: number, y: number, blockType: BlockType): void {
		if (x >= 0 && x < this.gridSize.x && y >= 0 && y < this.gridSize.y) {
			const index = this.getIndex(x, y);
			const instance = this.blocks[index];
			const sprite = instance.getComponent(cc.Sprite);
			sprite.spriteFrame = this.blockSpriteFrames[blockType];
		}
	}

	private updateMoves(moves: number): void {
		this.moves.string = moves.toString();
	}

	private updateScore(score: number): void {
		this.score.string = score.toString();
	}

	// HELPERS:

	private getIndex(x: number, y: number) {
		const ret = y * this.gridSize.x + x;
		return ret;
	}

	private getCellWidth(): number {
		return this.grid.cellSize.width + this.grid.spacingX;
	}

	private getCellHeight(): number {
		return this.grid.cellSize.height + this.grid.spacingY;
	}
}
