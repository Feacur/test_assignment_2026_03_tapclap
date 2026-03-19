import { BlockType } from "./BlockType";

export enum EventType {
	None = 0,
	Init, // initial or reshuffle
	Fill, // created during gameplay
	Wipe, // destroyed by actions
	Move, // changed position
	Yank, // move leftovers
};

interface BlockDelegate {
	(
		eventType: EventType,
		sourceX: number, sourceY: number, sourceType: BlockType,
		targetX: number, targetY: number, targetType: BlockType
	): void;
}

interface NumberDelegate {
	(value: number): void;
}

interface GetBoolDelegate {
	(): boolean;
}

export class GameProxy {
	updateBlock: BlockDelegate = null;
	updateMoves: NumberDelegate = null;
	updateScore: NumberDelegate = null;
	waitForAnim: GetBoolDelegate = null;
}
