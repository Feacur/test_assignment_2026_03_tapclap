import { TileType } from "./Tile";

export enum TileEvent {
	None = 0,
	Error,      // input issue
	Initialize, // start of the game
	Shuffle,    // triggered by game itself
	Damage,     // damaged by touch or chain reactions
	Spawn,      // created during gameplay
	Trail,      // left behind after a move
	Moved,      // tile changed position
};

export enum StateEvent {
	None = 0,
	Stuck,
	GameOver,
	Win,
};

interface TileDelegate {
	(
		tileEvent: TileEvent,
		sourceX: number, sourceY: number, sourceType: TileType,
		targetX: number, targetY: number, targetType: TileType
	): void;
}

interface NumberDelegate {
	(value: number): void;
}

interface StateDelegate {
	(value: StateEvent): void;
}

interface GetBoolDelegate {
	(): boolean;
}

export class GameProxy {
	updateTile:  TileDelegate    = null;
	updateMoves: NumberDelegate  = null;
	updateScore: NumberDelegate  = null;
	updateState: StateDelegate   = null;
	waitForAnim: GetBoolDelegate = null;
}
