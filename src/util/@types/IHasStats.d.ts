export default interface IHasStats<T extends string> {
	incrementStat(type: T): Promise<number>;
	decrementStat(type: T): Promise<number>;
	setStat(type: T, value: number): Promise<number>;
}
