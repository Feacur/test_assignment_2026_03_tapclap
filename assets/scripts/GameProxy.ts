import { BlockType } from "./BlockType";
import { Game } from "./Game";

interface BlockDelegate {
	(x: number, y: number, was: BlockType, now: BlockType): void;
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
