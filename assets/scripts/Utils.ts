export abstract class Utils {
	/**
	 * Returns a pseudorandom number between `min` and `max`.
	 * @param min Inclusive minimal random value.
	 * @param max Inclusive maximal random value.
	 */
	static randomRange(min: number, max: number) {
		// @todo use seed
		return Math.round(min + (max - min) * Math.random());
	}
}
