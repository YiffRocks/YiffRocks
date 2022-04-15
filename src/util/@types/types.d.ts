/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
// I despise this
// https://dev.to/svehla/typescript-transform-case-strings-450b

declare namespace Types {
	interface LowerToUpperToLowerCaseMapper {
		a: "A";
		b: "B";
		c: "C";
		d: "D";
		e: "E";
		f: "F";
		g: "G";
		h: "H";
		i: "I";
		j: "J";
		k: "K";
		l: "L";
		m: "M";
		n: "N";
		o: "O";
		p: "P";
		q: "Q";
		r: "R";
		s: "S";
		t: "T";
		u: "U";
		v: "V";
		w: "W";
		x: "X";
		y: "Y";
		z: "Z";
	}

	interface UpperToLowerCaseMapper {
		A: "a";
		B: "b";
		C: "c";
		D: "d";
		E: "e";
		F: "f";
		G: "g";
		H: "h";
		I: "i";
		J: "j";
		K: "k";
		L: "l";
		M: "m";
		N: "n";
		O: "o";
		P: "p";
		Q: "q";
		R: "r";
		S: "s";
		T: "t";
		U: "u";
		V: "v";
		W: "w";
		X: "x";
		Y: "y";
		Z: "z";
	}

	type HeadLetter<T> = T extends `${infer FirstLetter}${infer _}` ? FirstLetter : never;
	type TailLetters<T> = T extends `${infer _}${infer Rest}` ? Rest : never;

	type LetterToUpper<T> = T extends `${infer FirstLetter}${infer _}`
		? FirstLetter extends keyof LowerToUpperToLowerCaseMapper
			? LowerToUpperToLowerCaseMapper[FirstLetter]
			: FirstLetter
		: T;

	type LetterToLower<T> = T extends `${infer FirstLetter}${infer _}`
		? FirstLetter extends keyof UpperToLowerCaseMapper
			? UpperToLowerCaseMapper[FirstLetter]
			: FirstLetter
		: T;

	type ToLowerCase<T> = T extends ""
		? T
		: `${LetterToLower<HeadLetter<T>>}${ToLowerCase<TailLetters<T>>}`;

	// First letter is upper rest is lower
	type ToSentenceCase<T> = `${LetterToUpper<HeadLetter<T>>}${ToLowerCase<TailLetters<T>>}`;

	type ToPascalCase<T> = T extends ""
		? T
		: T extends `${infer FirstWord}_${infer RestLetters}`
			? `${ToSentenceCase<FirstWord>}${ToPascalCase<RestLetters>}`
			: ToSentenceCase<T>;

	export type UpperCaseToCamelCase<T> = `${ToLowerCase<HeadLetter<T>>}${TailLetters<ToPascalCase<T>>}`;

	// apply snake case into objects
	type Cast<T, U> = T extends U ? T : U;
	type GetObjValues<T> = T extends Record<any, infer V> ? V : never;

	type CallRecursiveTransformIfObj<T> = T extends Record<any, any> ? TransformKeysToPascalCase<T> : T;
	type CallRecursiveTransformIfObj2<T> = T extends Record<any, any> ? TransformKeysToLowerCase<T> : T;

	export type SwitchKeyValue<
		T,
		T1 extends Record<string, any> = {
			[K in keyof T]: { key: K; value: T[K]; }
		},
		T2 = {
			[K in GetObjValues<T1>["value"]]: Extract<GetObjValues<T1>, { value: K; }>["key"]
		}
	> = T2;

	type TransformKeysToPascalCase<
		T extends Record<string, any>,
		T0 = { [K in keyof T]: ToPascalCase<K> },
		T1 = SwitchKeyValue<T0>,
		T2 = { [K in keyof T1]: CallRecursiveTransformIfObj<T[Cast<T1[K], string>]> }
	> = T2;

	type TransformKeysToLowerCase<
		T extends Record<string, any>,
		T0 = { [K in keyof T]: Lowercase<K> },
		T1 = SwitchKeyValue<T0>,
		T2 = { [K in keyof T1]: CallRecursiveTransformIfObj2<T[Cast<T1[K], string>]> }
	> = T2;
}

export = Types;
