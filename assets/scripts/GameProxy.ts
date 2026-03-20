import { TileType } from "./Tile";

export enum EventType {
	None = 0,
	Error,   // input issue
	Init,    // start of the game
	Damage,  // damaged by touch or chain reactions
	Spawn,   // created during gameplay
	Trail,   // left behind after a move
	Moved,   // tile changed position
};

interface TileDelegate {
	(
		eventType: EventType,
		sourceX: number, sourceY: number, sourceType: TileType,
		targetX: number, targetY: number, targetType: TileType
	): void;
}

interface NumberDelegate {
	(value: number): void;
}

interface GetBoolDelegate {
	(): boolean;
}

export class GameProxy {
	updateTile:  TileDelegate    = null;
	updateMoves: NumberDelegate  = null;
	updateScore: NumberDelegate  = null;
	waitForAnim: GetBoolDelegate = null;
}
