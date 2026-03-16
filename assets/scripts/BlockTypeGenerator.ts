import { BlockType } from './BlockType';

export abstract class BlockTypeGenerator {
	static weights: number[] = new Array(BlockType.__COUNT__);
	static weightsSum: number = 0;
	public static _initialize() {
		// @note explicitly set weight just for type safety
		BlockTypeGenerator.weights[BlockType.None]              = 0;
		BlockTypeGenerator.weights[BlockType.Blue]              = 100;
		BlockTypeGenerator.weights[BlockType.Green]             = 100;
		BlockTypeGenerator.weights[BlockType.Purple]            = 100;
		BlockTypeGenerator.weights[BlockType.Red]               = 100;
		BlockTypeGenerator.weights[BlockType.Yellow]            = 100;
		BlockTypeGenerator.weights[BlockType.BombTiny]          = 10;
		BlockTypeGenerator.weights[BlockType.BombHuge]          = 5;
		BlockTypeGenerator.weights[BlockType.RocketsVertical]   = 10;
		BlockTypeGenerator.weights[BlockType.RocketsHorizontal] = 10;
		//
		BlockTypeGenerator.weightsSum = 0;
		for (let index = 0; index < BlockTypeGenerator.weights.length; index++)
			BlockTypeGenerator.weightsSum += BlockTypeGenerator.weights[index];
	}

	public static generate(): BlockType {
		let rnd = Math.round(Math.random() * BlockTypeGenerator.weightsSum);
		for (let index = 0; index < BlockTypeGenerator.weights.length; index++) {
			rnd -= BlockTypeGenerator.weights[index];
			if (rnd <= 0) return index;
		}
		return 0;
	}
}
BlockTypeGenerator._initialize();
