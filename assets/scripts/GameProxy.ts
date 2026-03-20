import { BoostType } from "./Game";
import { TileType } from "./Tile";

export enum TileEvent {
	None = 0,
	Initialize,   // start of the game
	Shuffle,      // triggered by game itself
	Damage,       // damaged by touch or chain reactions
	Spawn,        // created during gameplay
	Trail,        // left behind after a move
	Moved,        // tile changed position
	NonGameTouch, // just being responsive
};

export enum StateEvent {
	None = 0,
	Stuck,
	Lost,
	Won,
};

interface TileDelegate {
	(
		tileEvent: TileEvent,
		sourceX: number, sourceY: number, sourceType: TileType,
		targetX: number, targetY: number, targetType: TileType
	): void;
}

interface RangeDelegate {
	(value1: number, value2: number): void;
}

interface StateDelegate {
	(value: StateEvent): void;
}

interface BoostDelegate {
	(type: BoostType, quantity: number): void;
}

interface GetBoolDelegate {
	(): boolean;
}

export class GameProxy {
	updateTile:  TileDelegate    = null;
	updateMoves: RangeDelegate   = null;
	updateScore: RangeDelegate   = null;
	updateState: StateDelegate   = null;
	updateBoost: BoostDelegate   = null;
	waitForAnim: GetBoolDelegate = null;
}
