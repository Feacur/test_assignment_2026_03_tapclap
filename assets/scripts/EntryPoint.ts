// Learn TypeScript:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/typescript.html
// Learn Attribute:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/reference/attributes.html
// Learn life-cycle callbacks:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/life-cycle-callbacks.html

import { BlockType } from "./BlockType";
import { BlockTypeGenerator } from "./BlockTypeGenerator";

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

	blocks: cc.Node[] = null;

	// LIFE-CYCLE CALLBACKS:

	onLoad () {
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
		this.blocks = new Array(this.gridSize.x * this.gridSize.y);
	}

	start () {
		this.initializeGridOfBlocks();
	}

	// update (dt) {}

	// BUTTON CALLBACKS:

	boosterTeleOnClick (event: Event, customEventData: string) {
		console.log("clicked booster tele");
	}
	
	boosterBombOnClick (event: Event, customEventData: string) {
		console.log("clicked booster bomb");
	}

	// LOGIC:

	initializeGridOfBlocks () {
		this.grid.node.width = this.gridSize.x * (this.grid.cellSize.width + this.grid.spacingX) + (this.grid.paddingLeft + this.grid.paddingRight);
		this.grid.node.height = this.gridSize.y * (this.grid.cellSize.height + this.grid.spacingY) + (this.grid.paddingBottom + this.grid.paddingTop);
		for (let y = 0; y < this.gridSize.y; y++) {
			for (let x = 0; x < this.gridSize.x; x++) {
				const instance = cc.instantiate(this.gridPrefab);
				instance.parent = this.grid.node;
				this.blocks[this.gridSize.x * y + x] = instance;

				instance.setPosition(
					x * (this.grid.cellSize.width + this.grid.spacingX) + this.grid.paddingLeft,
					y * (this.grid.cellSize.height + this.grid.spacingY) + this.grid.paddingBottom
				);

				const blockType = BlockTypeGenerator.generate();
				const sprite = instance.getComponent(cc.Sprite);
				sprite.spriteFrame = this.blockSpriteFrames[blockType];
			}
		}
	}
}
