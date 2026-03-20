export abstract class Utils {
	/**
	 * Returns a pseudorandom number between `min` and `max`.
	 * @param min Inclusive minimal random value.
	 * @param max Inclusive maximal random value.
	 */
	static randomRange(min: number, max: number) {
		const t = Math.random(); // @todo use seed
		const raw = min * (t - 1) + max * t;
		return Math.round(raw);
	}
}
