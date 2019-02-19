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

import HttpStatus from 'http-status';
import fixtureFactory from '@natlibfi/fixura';
import chai, {expect} from 'chai';
import chaiHttp from 'chai-http';
import oracledbMockFactory from './oracledb-mock';
import startApp, {__RewireAPI__ as RewireAPI} from './index'; // eslint-disable-line import/named

chai.use(chaiHttp);

describe('providers/bib/privileged', () => {
	let requester;

	const fixturesPath = [__dirname, '..', '..', '..', '..', 'test-fixtures', 'providers', 'bib', 'privileged'];
	const {getFixture} = fixtureFactory({root: fixturesPath});

	beforeEach(async () => {
		RewireAPI.__Rewire__('oracledb', oracledbMockFactory());

		const httpPort = 1337;
		const maxResults = 10;
		const instanceUrl = `http://localhost:${httpPort}`;
		const oaiIdentifierPrefixBase = 'oai:foo.bar';
		const z106Library = 'FOO01';
		const oracleUsername = 'foo';
		const oraclePassword = 'bar';
		const oracleConnectString = 'BAR';

		const app = await startApp({
			httpPort, maxResults, instanceUrl, oaiIdentifierPrefixBase, z106Library,
			oracleUsername, oraclePassword, oracleConnectString
		});

		requester = chai.request(app).keepOpen();
	});

	afterEach(async () => {
		await requester.close();
		RewireAPI.__ResetDependency__('oracledb');
	});

	describe('#ListRecords', () => {
		it('TESTING', async (index = '0') => {
			const expectedPayload = getFixture(['ListRecords', index, 'expectedPayload.xml']);
			const response = await requester.get('/?verb=ListRecords');

			expect(response).to.have.status(HttpStatus.OK);
			expect(response.body).to.equal(expectedPayload);
		});

		/* It('Should fail because the resource does not exist', async () => {
			const response = await requester.get(`${requestPath}/foo`);
			expect(response).to.have.status(HttpStatus.NOT_FOUND);
		}); */

		/* async function init(index, getFixtures = false) {
			await mongoFixtures.populate(['read', index, 'dbContents.json']);
			if (getFixtures) {
				return {
					expectedPayload: getFixture({components: ['read', index, 'expectedPayload.json'], reader: READERS.JSON})
				};
			}
		} */
	});
});
