import { Utils } from "./Utils";

export enum TileType {
	None = 0, // means "empty tile", but might be better to create and use an official one
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
		for (let type: TileType = 0; type < TileGenerator.weights.length; type++)
			TileGenerator.weightsSum += TileGenerator.weights[type];
	}

	public static generate(): TileType {
		// @todo use seed
		let rnd = Utils.randomRange(0, TileGenerator.weightsSum);
		for (let type: TileType = 0; type < TileGenerator.weights.length; type++) {
			rnd -= TileGenerator.weights[type];
			if (rnd <= 0) return type;
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
		return TileValue.points[type];
	}
}
TileValue._initialize();

export abstract class TileUtils {
	static canBeTouched(type: TileType): boolean {
		// imagine a brick wall that can be damaged indirectly
		// either by a bomb or a flood filled area nearby,
		// but otherwise would be non-interactable
		return type != TileType.None;
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
		// imagine synergies between, say, a rocket and a bomb
		// will require logic changes though to be properly triggered,
		// for example making its damaging path wider
		return aType == bType;
	}

	static canBeFloodFilled(type: TileType): boolean {
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

	static canBeDamaged(type: TileType): boolean {
		return type != TileType.None;
	}

	static canBeTeleported(type: TileType): boolean {
		return type != TileType.None;
	}

	static canBeSpawnTarget(type: TileType): boolean {
		return type == TileType.None;
	}

	static isMovePossible(sourceType: TileType, targetType: TileType): boolean {
		// imagine a spiked object falling onto a ball
		return sourceType != TileType.None
		/**/&& targetType == TileType.None;
	}

	static getTrailType(sourceType: TileType, targetType: TileType): TileType {
		// imagine a slime block that leaves behind a trail when it moves
		// or that may be a pipe which ejects new blocks to the board
		return TileType.None;
	}

	static getMovedType(sourceType: TileType, targetType: TileType): TileType {
		// imagine an ice block that melts if moved
		return sourceType;
	}

	static getDamagedType(type: TileType): TileType {
		// imagine a chest that leaves a gem behind
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
