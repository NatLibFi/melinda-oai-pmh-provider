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

export function createLowFilter(value) {
	return createSubfieldValueFilter([{tag: 'LOW', code: /^a$/, value}]);
}

export function createLow020Filter(value) {
	return createSubfieldValueFilter([{tag: 'LOW', code: /^a$/, value}]);
}

export function createSidFilter(value) {
	return createSubfieldValueFilter([{tag: 'SID', code: /^a$/, value}]);
}

export function create960Filter(value) {
	return createSubfieldValueFilter([{tag: '960', code: /^a$/, value}]);
}

export function createLeaderFilter({start, end, value}) {
	return record => compareSubstring({
		start, end, value,
		context: record.leader
	});
}

export function createControlFieldFilter({tag, start, end, value}) {
	return record => {
		return record.get(tag).every(({value: context}) => compareSubstring({
			context, start, end, value
		}));
	};
}

export function createSubfieldValueFilter(conditions) {
	const pattern = getPattern();

	return record => {
		const fields = record.get(pattern);

		return conditions.every(({tag, code, value}) => {
			return fields.some(f => {
				return f.tag === tag && f.subfields.some(sf => {
					return sf.code === code && sf.value === value;
				});
			});
		});
	};

	function getPattern() {
		const str = conditions.map(({tag}) => tag).join('|');
		return new RegExp(`^(${str})$`);
	}
}

export function createHasFieldFilter(tag) {
	return record => record.get(tag).length > 0;
}

function compareSubstring({context, start, end, value}) {
	const chunk = context.substring(start, end + 1);
	return chunk === value;
}
