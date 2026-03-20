export enum TileType {
	None = 0,
	Blue,
	Green,
	Purple,
	Red,
	Yellow,
	BombTiny,
	BombHuge,
	RocketsVert,
	RocketsHori,
	__COUNT__,
}

export abstract class TileGenerator {
	private static weights: number[] = new Array(TileType.__COUNT__);
	private static weightsSum: number = 0;
	public static _initialize(): void {
		// @note explicitly set weight just for type safety
		TileGenerator.weights[TileType.None]        = 0;
		TileGenerator.weights[TileType.Blue]        = 100;
		TileGenerator.weights[TileType.Green]       = 100;
		TileGenerator.weights[TileType.Purple]      = 100;
		TileGenerator.weights[TileType.Red]         = 100;
		TileGenerator.weights[TileType.Yellow]      = 100;
		TileGenerator.weights[TileType.BombTiny]    = 10;
		TileGenerator.weights[TileType.BombHuge]    = 5;
		TileGenerator.weights[TileType.RocketsVert] = 10;
		TileGenerator.weights[TileType.RocketsHori] = 10;
		//
		TileGenerator.weightsSum = 0;
		for (let index = 0; index < TileGenerator.weights.length; index++)
			TileGenerator.weightsSum += TileGenerator.weights[index];
	}

	public static generate(): TileType {
		let rnd = Math.round(Math.random() * TileGenerator.weightsSum);
		for (let index = 0; index < TileGenerator.weights.length; index++) {
			rnd -= TileGenerator.weights[index];
			if (rnd <= 0) return index;
		}
		return 0;
	}
}
TileGenerator._initialize();

export abstract class TileValue {
	private static points: number[] = new Array(TileType.__COUNT__);
	public static _initialize(): void {
		// @note explicitly set weight just for type safety
		TileValue.points[TileType.None]        = 0;
		TileValue.points[TileType.Blue]        = 1;
		TileValue.points[TileType.Green]       = 1;
		TileValue.points[TileType.Purple]      = 1;
		TileValue.points[TileType.Red]         = 1;
		TileValue.points[TileType.Yellow]      = 1;
		TileValue.points[TileType.BombTiny]    = 3;
		TileValue.points[TileType.BombHuge]    = 4;
		TileValue.points[TileType.RocketsVert] = 2;
		TileValue.points[TileType.RocketsHori] = 2;
	}

	public static get(type: TileType): number {
		const ret = TileValue.points[type];
		return ret;
	}
}
TileValue._initialize();

export abstract class TileUtils {
	static isTouchanble(type: TileType): boolean {
		switch (type) {
			case TileType.None:
				return false;
		}
		return true;
	}

	static getMinAreaToDamage(type: TileType): number {
		switch (type) {
			case TileType.Blue:
			case TileType.Green:
			case TileType.Purple:
			case TileType.Red:
			case TileType.Yellow:
				return 2;
		}
		return 1;
	}

	static matchFloodFill(aType: TileType, bType: TileType): boolean {
		return aType == bType;
	}

	static isFloodFillable(type: TileType): boolean {
		switch (type) {
			case TileType.Blue:
			case TileType.Green:
			case TileType.Purple:
			case TileType.Red:
			case TileType.Yellow:
				return true;
		}
		return false;
	}

	static isDestructible(type: TileType): boolean {
		switch (type) {
			case TileType.None:
				return false;
		}
		return true;
	}

	static canBeMoveSource(type: TileType): boolean {
		switch (type) {
			case TileType.None:
				return false;
		}
		return true;
	}

	static canBeMoveTarget(type: TileType): boolean {
		switch (type) {
			case TileType.None:
				return true;
		}
		return false;
	}

	static isFillable(type: TileType): boolean {
		switch (type) {
			case TileType.None:
				return true;
		}
		return false;
	}

	static getTrailType(type: TileType): TileType {
		return TileType.None;
	}

	static getDamagedType(type: TileType): TileType {
		return TileType.None;
	}

	static getDamageRadius(type: TileType): number {
		switch (type) {
			case TileType.BombTiny:    return 1;
			case TileType.BombHuge:    return 2;
			case TileType.RocketsVert: return 0;
			case TileType.RocketsHori: return 0;
		}
		return 0;
	}
}
