/**
* Copyright 2019 University Of Helsinki (The National Library Of Finland)
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/

export default obj => {
	return proc(obj).trim();

	function proc(ctx, level = 0) {
		return ctx.reduce((acc, spec) => {
			const stmt = typeof spec === 'string' ? spec : spec.stmt;
			const sub = typeof spec === 'object' ? spec.sub : undefined;

			if (sub) {
				return `${acc}\n${genLevel(level)}${stmt}${proc(sub, level + 1)}`;
			}

			return `${acc}\n${genLevel(level)}${stmt}`;
		}, '');

		function genLevel(level) {
			return Array(level).fill('\t').join('');
		}
	}
};

export function generateOr({conditions, toSub = false}) {
	return genConditionalStatements({
		conditions, toSub,
		separator: 'OR'
	});
}

export function generateAnd({conditions, toSub = false}) {
	return genConditionalStatements({
		conditions, toSub,
		separator: 'AND'
	});
}

function genConditionalStatements({conditions, toSub = false, separator}) {
	const parts = conditions
		.slice()
		.reverse()
		.map((v, i) => i === 0 ? v : `${v} ${separator} `)
		.reverse();

	return toSub ? parts : `(${parts.join('')})`;
}
