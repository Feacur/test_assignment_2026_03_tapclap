export enum BlockType {
	None = 0,
	Blue,
	Green,
	Purple,
	Red,
	Yellow,
	BombTiny,
	BombHuge,
	RocketsVertical,
	RocketsHorizontal,
	__COUNT__,
}

export abstract class BlockTypeGenerator {
	private static weights: number[] = new Array(BlockType.__COUNT__);
	private static weightsSum: number = 0;
	public static _initialize(): void {
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

export abstract class BlockTypeValue {
	private static points: number[] = new Array(BlockType.__COUNT__);
	public static _initialize(): void {
		// @note explicitly set weight just for type safety
		BlockTypeValue.points[BlockType.None]              = 0;
		BlockTypeValue.points[BlockType.Blue]              = 1;
		BlockTypeValue.points[BlockType.Green]             = 1;
		BlockTypeValue.points[BlockType.Purple]            = 1;
		BlockTypeValue.points[BlockType.Red]               = 1;
		BlockTypeValue.points[BlockType.Yellow]            = 1;
		BlockTypeValue.points[BlockType.BombTiny]          = 3;
		BlockTypeValue.points[BlockType.BombHuge]          = 4;
		BlockTypeValue.points[BlockType.RocketsVertical]   = 2;
		BlockTypeValue.points[BlockType.RocketsHorizontal] = 2;
	}

	public static get(blockType: BlockType): number {
		const ret = BlockTypeValue.points[blockType];
		return ret;
	}
}
BlockTypeValue._initialize();

export abstract class BlockTypeUtils {
	static isFloodFillable(blockType: BlockType): boolean {
		switch (blockType) {
			case BlockType.Blue:
			case BlockType.Green:
			case BlockType.Purple:
			case BlockType.Red:
			case BlockType.Yellow:
				return true;
		}
		return false;
	}
	static match(aType: BlockType, bType: BlockType): boolean {
		return aType == bType;
	}

	static isDestructible(blockType: BlockType): boolean {
		switch (blockType) {
			case BlockType.None:
				return false;
		}
		return true;
	}

	static isMovable(blockType: BlockType): boolean {
		switch (blockType) {
			case BlockType.None:
				return false;
		}
		return true;
	}

	static isReplaceable(blockType: BlockType): boolean {
		switch (blockType) {
			case BlockType.None:
				return true;
		}
		return false;
	}

	static getEmpty(sourceBlockType: BlockType): BlockType {
		return BlockType.None;
	}

	static getWipeRadius(blockType: BlockType): number {
		switch (blockType) {
			case BlockType.BombTiny: return 1;
			case BlockType.BombHuge: return 2;
		}
		return 0;
	}
}
