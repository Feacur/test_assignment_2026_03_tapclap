import { BlockType } from "./BlockType";

export enum EventType {
	None = 0,
	Init,
	Spawn,
	Wipe,
	Move,
	Fill,
};

interface BlockDelegate {
	(x: number, y: number, blockType: BlockType, eventType: EventType): void;
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
