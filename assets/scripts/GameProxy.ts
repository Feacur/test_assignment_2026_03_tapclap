import { BlockType } from "./BlockType";

interface BlockCallback {
	(x: number, y: number, blockType: BlockType);
}

interface NumberCallback {
	(value: number);
}

export class GameProxy {
	setBlockCallback: BlockCallback = null;
	updateMovesCallback: NumberCallback = null;
	updateScoreCallback: NumberCallback = null;
}
