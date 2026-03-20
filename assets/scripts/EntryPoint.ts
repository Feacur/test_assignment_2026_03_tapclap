// Learn TypeScript:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/typescript.html
// Learn Attribute:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/reference/attributes.html
// Learn life-cycle s:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/life-cycle-s.html

import { TileType } from "./Tile";
import { Game, GameSettings } from "./Game";
import { TileEvent, GameProxy, StateEvent } from "./GameProxy";

const {ccclass, property} = cc._decorator;

class Tile {
	x: number;
	y: number;
	type: TileType;
}

class Message {
	time: number;
	tileEvent: TileEvent;
	source: Tile = new Tile();
	target: Tile = new Tile();

	getDuration(): number {
		// @note Spawn, Trail, Moved are better being in sync
		// and at least move should be the longest of these three
		switch (this.tileEvent) {
			case TileEvent.Initialize: return 0;
			case TileEvent.Shuffle:    return 2;
			case TileEvent.Error:      return 0.1;
			case TileEvent.Damage:     return 0.4;
			case TileEvent.Spawn:      return 0.1;
			case TileEvent.Trail:      return 0.1;
			case TileEvent.Moved:      return 0.1;
		}
		return 0;
	}

	isBlocking(): boolean {
		switch (this.tileEvent) {
			case TileEvent.None:  return false;
			case TileEvent.Error: return false;
		}
		return true;
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

	@property(cc.Button)
	shuffleButton: cc.Button = null;

	@property(cc.Button)
	gameOverButton: cc.Button = null;

	@property(cc.Button)
	winButton: cc.Button = null;

	@property(cc.Layout)
	grid: cc.Layout = null;

	@property(cc.Prefab)
	tilePrefab: cc.Prefab = null;

	@property(cc.SpriteFrame)
	tileSpriteFrames: cc.SpriteFrame[] = new Array(TileType.__COUNT__);

	private tiles: cc.Node[] = [];

	private gameProxy: GameProxy = new GameProxy();
	private game: Game = new Game(this.gameProxy);
	private settings: GameSettings = new GameSettings();

	private messages: Message[] = []
	private messagesSet: number = 0; // @note reuse message instances
	private messagesTime: number = 0;

	// LIFE-CYCLE:

	onLoad(): void {
		// sanity check sprites
		this.grid.enabled = false;
		if (this.tileSpriteFrames.length != TileType.__COUNT__) {
			this.tileSpriteFrames.length = TileType.__COUNT__;
			console.log("[warn] `tileSpriteFrames` length reset to %d", TileType.__COUNT__);
		}

		// setup input
		this.grid.node.on(cc.Node.EventType.TOUCH_START, this.onTouchStart, this, true);
		this.boosterTeleButton.clickEvents.push(this.createEventHanler("boosterTeleOnClick"));
		this.boosterBombButton.clickEvents.push(this.createEventHanler("boosterBomOnClick"));
		this.shuffleButton.clickEvents.push(this.createEventHanler("shuffleOnClick"));
		this.gameOverButton.clickEvents.push(this.createEventHanler("gameOverOnClick"));
		this.winButton.clickEvents.push(this.createEventHanler("winOnClick"));

		// setup proxy
		this.gameProxy.updateTile = (eventType: TileEvent,
			sourceX: number, sourceY: number, sourceType: TileType,
			targetX: number, targetY: number, targetType: TileType
		) => {
			// @todo compress messages with overlapping responsibilities into a single one
			this.pushMessage(eventType,
				sourceX, sourceY, sourceType,
				targetX, targetY, targetType
			);
		}
		this.gameProxy.updateMoves = (value: number): void => { this.updateMoves(value); }
		this.gameProxy.updateScore = (value: number): void => { this.updateScore(value); }
		this.gameProxy.updateState = (value: StateEvent): void => { this.updateState(value); }
		this.gameProxy.waitForAnim = (): boolean => { return this.isAnimationBlocking(); }

		// setup settings
		this.settings.size.x = 9;
		this.settings.size.y = 9;
		this.settings.regenLimit = 3;
		this.settings.movesLimit = 30;
		this.settings.scoreLimit = 300;
	}

	start(): void {
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
		if (x >= 0 && x < this.settings.size.x && y >= 0 && y < this.settings.size.y)
			this.game.inputTouchTile(x, y);
	}

	private boosterTeleOnClick (event: Event, customEventData: string): void {
		console.log("clicked booster tele");
	}
	
	private boosterBombOnClick (event: Event, customEventData: string): void {
		console.log("clicked booster bomb");
	}
	
	private shuffleOnClick (event: Event, customEventData: string): void {
		this.game.inputShuffle();
	}
	
	private gameOverOnClick (event: Event, customEventData: string): void {
		this.initializeGame();
	}
	
	private winOnClick (event: Event, customEventData: string): void {
		this.initializeGame();
	}

	// LOGIC:

	private initializeGame (): void {
		this.grid.node.width = this.settings.size.x * this.getCellWidth() + (this.grid.paddingLeft + this.grid.paddingRight);
		this.grid.node.height = this.settings.size.y * this.getCellHeight() + (this.grid.paddingBottom + this.grid.paddingTop);

		const boardTilesCount = this.settings.size.x * this.settings.size.y;
		if (this.tiles.length < boardTilesCount) {
			const currentTilesCount = this.tiles.length;
			this.tiles.length = boardTilesCount;
			for (let index = currentTilesCount; index < this.tiles.length; index++) {
				const instance = cc.instantiate(this.tilePrefab);
				instance.parent = this.grid.node;
				this.tiles[index] = instance;
			}
		}

		for (let index = 0; index < this.tiles.length; index++) {
			const instance = this.tiles[index];
			instance.active = index < boardTilesCount;
		}

		this.game.initialize(this.settings);
	}

	private updateTile (x: number, y: number, type: TileType): void {
		if (x >= 0 && x < this.settings.size.x && y >= 0 && y < this.settings.size.y) {
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

	private updateState(state: StateEvent): void {
		this.shuffleButton.node.active = state == StateEvent.Stuck;
		this.gameOverButton.node.active = state == StateEvent.GameOver;
		this.winButton.node.active = state == StateEvent.Win;
	}

	// MESSAGING:

	private isAnimationBlocking(): boolean {
		// @optimize or cache numbers on push and pop
		for (let it = 0; it < this.messagesSet; it++) {
			const message = this.messages[it];
			if (message.isBlocking())
				return true;
		}
		return false;
	}

	private pushMessage(tileEvent: TileEvent,
		sourceX: number, sourceY: number, sourceType: TileType,
		targetX: number, targetY: number, targetType: TileType
	) { // @note messages array can be prepopulated, OTOH it's not a bottleneck anyway
		if (this.messagesSet >= this.messages.length)
			this.messages.push(new Message());

		const message = this.messages[this.messagesSet];
		this.messagesSet += 1;

		message.time = this.messagesTime;
		message.tileEvent = tileEvent;

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
		this.messagesTime += dt;
		for (let it = 0; it < this.messagesSet; it++) {
			const message = this.messages[it];
			const index = this.getIndex(message.target.x, message.target.y);
			const instance = this.tiles[index];

			const duration = message.getDuration();
			const elapsed = this.messagesTime - message.time;
			const progress = duration > 0 ? Math.min(elapsed / duration, 1) : 1;

			switch (message.tileEvent) {
				case TileEvent.Error: {
					const amplitude = 20;
					const frequency = Math.PI * 2;
					instance.angle = amplitude * Math.sin(frequency * progress);
				} break;

				case TileEvent.Initialize: {
					instance.scale = 1;
					const visualType = message.target.type;
					this.updateTile(message.target.x, message.target.y, visualType);
					this.setTileVisualPosition(instance, message.target.x, message.target.y);
				} break;

				case TileEvent.Shuffle: {
					const pivotMoment = 0.5;
					instance.scale = progress < pivotMoment
						? 1 - cc.easing.backIn(progress / pivotMoment)
						: cc.easing.elasticOut((progress - pivotMoment) / pivotMoment);
					const visualType = progress < pivotMoment ? message.source.type : message.target.type;
					this.updateTile(message.target.x, message.target.y, visualType);
				} break;

				case TileEvent.Damage: {
					const pivotMoment = 0.8;
					instance.scale = progress < pivotMoment ? 1 - cc.easing.backIn(progress) : 1;
					const visualType = progress < pivotMoment ? message.source.type : message.target.type;
					this.updateTile(message.target.x, message.target.y, visualType);
				} break;

				case TileEvent.Spawn: {
					instance.scale = cc.easing.circIn(progress);
					const visualType = message.target.type;
					this.updateTile(message.target.x, message.target.y, visualType);
				} break;

				case TileEvent.Trail: {
					const visualType = message.target.type;
					this.updateTile(message.target.x, message.target.y, visualType);
				} break;

				case TileEvent.Moved: {
					const visualType = message.target.type;
					this.updateTile(message.target.x, message.target.y, visualType);

					// @todo bounce when an obstacle reached
					const visualX = cc.misc.lerp(message.source.x, message.target.x, progress);
					const visualY = cc.misc.lerp(message.source.y, message.target.y, progress);
					this.setTileVisualPosition(instance, visualX, visualY);
				} break;
			}
		}

		// @note it's possible to drop messages in the middle, but we risk
		// putting the UI into faulty state depending on duration settings
		this.messagesSet = 0;
		for (let it = 0; it < prevSet; it++) {
			const message = this.messages[it];
			const emptyIndex = this.messagesSet;
			const elapsed = this.messagesTime - message.time;
			if (elapsed < message.getDuration()) {
				this.messagesSet += 1;
				if (emptyIndex < it) {
					this.messages[it] = this.messages[emptyIndex]; // move processed up
					this.messages[emptyIndex] = message;           // move pending down
				}
			}
		}

		// finalize
		if (this.messagesSet == 0)
			this.messagesTime = 0;
	}

	// HELPERS:

	private getIndex(x: number, y: number) {
		return y * this.settings.size.x + x;
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

	private setTileVisualPosition (instance: cc.Node, x: number, y: number): void {
		instance.setPosition(
			x * this.getCellWidth() + this.getCellPaddingLeft(),
			y * this.getCellHeight() + this.getCellPaddingBottom()
		);
	}

	private createEventHanler(handler: string): cc.Component.EventHandler {
		const ret = new cc.Component.EventHandler();
		ret.target = this.node;
		ret.component = EntryPoint.name;
		ret.handler = handler;
		return ret;
	}
}
