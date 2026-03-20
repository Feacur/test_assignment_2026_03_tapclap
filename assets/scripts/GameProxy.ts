import { TileType } from "./Tile";

export enum EventType {
	None = 0,
	Errr, // processing can't be started
	Init, // initial or reshuffle
	Fill, // created during gameplay
	Wipe, // destroyed by actions
	Yank, // move leftovers
	Move, // changed position
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
