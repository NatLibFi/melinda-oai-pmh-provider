
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

import {readdirSync} from 'fs';
import {join as joinPath} from 'path';
import moment from 'moment';
import {expect} from 'chai';
import factory from './query';
import fixtureFactory, {READERS} from '@natlibfi/fixura';

describe('middlewares/bib/query', () => {
	const fixturesPath = [__dirname, '..', '..', '..', 'test-fixtures', 'bib', 'query'];
	const {getFixture} = fixtureFactory({
		root: fixturesPath,
		reader: READERS.JSON
	});

	describe('factory', () => {
		const limit = 1000;
		const library = 'foo01';

		it('Should create the expected object', () => {
			expect(factory({library, limit}))
				.to.have.include.all.keys([
					'getSingleRecord',
					'getRecords',
					'getEarliestTimestamp',
					'getHeadingsIndex'
				])
				.and.to.respondTo('getSingleRecord')
				.and.to.respondTo('getRecords');
		});

		generateTestSuite('getEarliestTimestamp');
		generateTestSuite('getHeadingsIndex');
		generateTestSuite('getSingleRecord');
		generateTestSuite('getRecords');

		function generateTestSuite(name) {
			describe(`#${name}`, () => {
				const {[name]: queryFactory} = factory({limit, library});
				const dir = joinPath.apply(undefined, fixturesPath.concat(name));

				readdirSync(dir).forEach(subdir => {
					const {descr, skip, params} = getFixture([name, subdir, 'metadata.json']);

					if (skip) {
						it.skip(`${subdir} ${descr}`);
					} else {
						it(`${subdir} ${descr}`, () => {
							const expectedQuery = getFixture([name, subdir, 'expectedQuery.json']);
							const expectedArgs = getArgs();

							const {query, args} = queryFactory(formatParams(params));

							expect(query).to.eql(expectedQuery);
							expect(args).to.eql(expectedArgs);

							function formatParams(params) {
								return params ?
									Object.entries(params).reduce((acc, [key, value]) => {
										return {
											...acc,
											[key]: isTimeKey() ? moment(value) : value
										};

										function isTimeKey() {
											return ['start', 'end'].includes(key);
										}
									}, {}) : {};
							}

							function getArgs() {
								try {
									return getFixture([name, subdir, 'expectedArgs.json']);
								} catch (err) {
									if (err.code === 'ENOENT') {
										return undefined;
									}
								}
							}
						});
					}
				});
			});
		}
	});
});
