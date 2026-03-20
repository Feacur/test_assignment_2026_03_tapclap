// Learn TypeScript:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/typescript.html
// Learn Attribute:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/reference/attributes.html
// Learn life-cycle s:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/life-cycle-s.html

import { TileType } from "./Tile";
import { Game } from "./Game";
import { EventType, GameProxy } from "./GameProxy";

const {ccclass, property} = cc._decorator;

class Tile {
	x: number;
	y: number;
	type: TileType;
}

class Message {
	eventType: EventType;
	source: Tile = new Tile();
	target: Tile = new Tile();

	getDuration(): number {
		switch (this.eventType) {
			case EventType.Errr: return 0.1;
			case EventType.Fill: return 0.1;
			case EventType.Wipe: return 0.2;
			case EventType.Move: return 0.1;
			case EventType.Yank: return 0.1;
		}
		return 0;
	}
}

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
	tilePrefab: cc.Prefab = null;

	@property(cc.SpriteFrame)
	tileSpriteFrames: cc.SpriteFrame[] = new Array(TileType.__COUNT__);

	@property(cc.Vec2)
	gridSize: cc.Vec2 = new cc.Vec2(5, 5);

	private gameProxy: GameProxy = null;
	private tiles: cc.Node[] = null;
	private game: Game = null;

	private messages: Message[] = []
	private messagesSet: number = 0; // @note reuse message instances
	private messagesTime: number = 0;

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
		if (this.tileSpriteFrames.length != TileType.__COUNT__) {
			this.tileSpriteFrames.length = TileType.__COUNT__;
			console.log("[warn] `tileSpriteFrames` length reset to %d", TileType.__COUNT__);
		}

		this.gridSize.x = Math.floor(this.gridSize.x);
		this.gridSize.y = Math.floor(this.gridSize.y);
		if (this.gridSize.x > 9) this.gridSize.x = 9;
		if (this.gridSize.y > 9) this.gridSize.y = 9;

		this.gameProxy = new GameProxy();
		this.gameProxy.updateTile = (eventType: EventType,
			sourceX: number, sourceY: number, sourceType: TileType,
			targetX: number, targetY: number, targetType: TileType
		) => {
			this.pushMessage(eventType,
				sourceX, sourceY, sourceType,
				targetX, targetY, targetType
			);
		}
		this.gameProxy.updateMoves = (value: number): void => { this.updateMoves(value); }
		this.gameProxy.updateScore = (value: number): void => { this.updateScore(value); }
		this.gameProxy.waitForAnim = (): boolean => { return this.messagesSet > 0; }
	}

	start(): void {
		this.grid.node.width = this.gridSize.x * this.getCellWidth() + (this.grid.paddingLeft + this.grid.paddingRight);
		this.grid.node.height = this.gridSize.y * this.getCellHeight() + (this.grid.paddingBottom + this.grid.paddingTop);
		this.initializeGame();
	}

	update(dt: number): void {
		this.game.tick(dt);
		this.processMessages(dt);
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
			this.game.inputTouchTile(x, y);
	}

	private boosterTeleOnClick (event: Event, customEventData: string): void {
		console.log("clicked booster tele");
	}
	
	private boosterBombOnClick (event: Event, customEventData: string): void {
		console.log("clicked booster bomb");
	}

	// LOGIC:

	private initializeGame (): void {
		// @todo reuse tiles on reinit or at least despawn them
		this.tiles = new Array(this.gridSize.x * this.gridSize.y);
		for (let y = 0; y < this.gridSize.y; y++) {
			for (let x = 0; x < this.gridSize.x; x++) {
				const instance = cc.instantiate(this.tilePrefab);
				const index = this.getIndex(x, y);
				this.tiles[index] = instance;
			}
		}

		for (let y = 0; y < this.gridSize.y; y++) {
			for (let x = 0; x < this.gridSize.x; x++) {
				const index = this.getIndex(x, y);
				let instance = this.tiles[index];
				instance.parent = this.grid.node;
				this.setTileVisualPosition(instance, x, y);
			}
		}

		this.game = new Game(this.gridSize, this.gameProxy);
		this.game.reinitTiles();
	}

	private setTileVisualPosition (instance: cc.Node, x: number, y: number): void {
		instance.setPosition(
			x * this.getCellWidth() + this.getCellPaddingLeft(),
			y * this.getCellHeight() + this.getCellPaddingBottom()
		);
	}

	private updateTile (x: number, y: number, type: TileType): void {
		if (x >= 0 && x < this.gridSize.x && y >= 0 && y < this.gridSize.y) {
			const index = this.getIndex(x, y);
			const instance = this.tiles[index];
			const sprite = instance.getComponent(cc.Sprite);
			sprite.spriteFrame = this.tileSpriteFrames[type];
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

	private getCellPaddingLeft(): number {
		return this.grid.paddingLeft + this.tilePrefab.data.width * this.tilePrefab.data.anchorX;
	}

	private getCellPaddingBottom(): number {
		return this.grid.paddingBottom + this.tilePrefab.data.height * this.tilePrefab.data.anchorY;
	}

	private pushMessage(eventType: EventType,
		sourceX: number, sourceY: number, sourceType: TileType,
		targetX: number, targetY: number, targetType: TileType
	) {
		if (this.messagesSet >= this.messages.length)
			this.messages.push(new Message());

		const message = this.messages[this.messagesSet];
		this.messagesSet += 1;

		message.eventType = eventType;

		message.source.x    = sourceX;
		message.source.y    = sourceY;
		message.source.type = sourceType;

		message.target.x    = targetX;
		message.target.y    = targetY;
		message.target.type = targetType;
	}
	
	private processMessages(dt: number): void {
		const prevSet = this.messagesSet;

		// animate
		let done = true;
		this.messagesTime += dt;
		for (let it = 0; it < this.messagesSet; it++) {
			const message = this.messages[it];
			const index = this.getIndex(message.target.x, message.target.y);
			const instance = this.tiles[index];
			const duration = message.getDuration();
			const progress = duration > 0 ? Math.min(this.messagesTime / duration, 1) : 1;

			if (progress < 1) done = false;

			switch (message.eventType) {
				case EventType.Errr: {
					const amplitude = 20;
					const frequency = Math.PI * 2;
					instance.rotation = amplitude * Math.sin(frequency * progress);
				} break;

				case EventType.Init: {
					instance.scale = progress;
					const visualType = message.target.type;
					this.updateTile(message.target.x, message.target.y, visualType);
				} break;

				case EventType.Fill: {
					instance.scale = progress;
					const visualType = message.target.type;
					this.updateTile(message.target.x, message.target.y, visualType);
				} break;

				case EventType.Wipe: {
					instance.scale = 1 - progress;
					const visualType = progress < 0.8 ? message.source.type : message.target.type;
					this.updateTile(message.target.x, message.target.y, visualType);
				} break;

				case EventType.Yank: {
					instance.scale = 1 - progress;
					const visualType = message.target.type;
					this.updateTile(message.target.x, message.target.y, visualType);
				} break;

				case EventType.Move: {
					instance.scale = 1;
					const visualType = message.target.type;
					this.updateTile(message.target.x, message.target.y, visualType);

					const visualX = cc.lerp(message.source.x, message.target.x, progress);
					const visualY = cc.lerp(message.source.y, message.target.y, progress);
					this.setTileVisualPosition(instance, visualX, visualY);
				} break;
			}
		}

		// @note it's possible to drop messages in the middle, but we risk
		// putting the UI into faulty state depending on duration settings
		// remove completed
		// this.messagesSet = 0;
		// for (let it = 0; it < prevSet; it++) {
		// 	const message = this.messages[it];
		// 	const emptyIndex = this.messagesSet;
		// 	if (this.messagesTime < message.getDuration()) {
		// 		this.messagesSet += 1;
		// 		if (emptyIndex < it) {
		// 			this.messages[it] = this.messages[emptyIndex]; // move processed up
		// 			this.messages[emptyIndex] = message;           // move pending down
		// 		}
		// 	}
		// }

		// finalize
		if (done) this.messagesSet = 0;
		if (this.messagesSet == 0)
			this.messagesTime = 0;
	}
}
