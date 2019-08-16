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

/* eslint-disable max-nested-callbacks */

import HttpStatus from 'http-status';
import chai, {expect} from 'chai';
import chaiHttp from 'chai-http';
import oracledbMockFactory from './oracledb-mock';
import startApp, {__RewireAPI__ as RewireAPI} from './app'; // eslint-disable-line import/named
import testSuiteFactory from './test-utils';

chai.use(chaiHttp);

describe('app', () => {
	let requester;

	const fixturesPath = [__dirname, '..', 'test-fixtures'];
	const oracledbMock = oracledbMockFactory();

	const generateTestSuite = testSuiteFactory({
		oracledbMock, requester,
		rootPath: fixturesPath
	});

	RewireAPI.__Rewire__('oracledb', oracledbMock);

	beforeEach(async () => {
		const httpPort = 1337;
		const secretEncryptionKey = 'foo';

		const instanceUrl = `http://localhost:${httpPort}`;
		const identifierPrefix = 'oai:foo.bar';
		const maxResults = 10;
		const resumptionTokenTimeout = 500;

		const oracleUsername = 'foo';
		const oraclePassword = 'bar';
		const oracleConnectString = 'BAR';

		const app = await startApp({
			httpPort, secretEncryptionKey, instanceUrl,
			identifierPrefix, maxResults, resumptionTokenTimeout,
			oracleUsername, oraclePassword, oracleConnectString
		});

		requester = chai.request(app).keepOpen();
	});

	afterEach(async () => {
		await requester.close();
		oracledbMock._clear();
	});

	after(() => {
		RewireAPI.__ResetDependency__('oracledb');
	});

	it('Shouldn\'t find the resource', async () => {
		const response = await requester.get('/foo');
		expect(response).to.have.status(HttpStatus.NOT_FOUND);
	});

	describe('bib', () => {
		/* Describe('unprivileged', () => {
			describe.skip('GetRecord');
			describe.skip('Identify');
			describe.skip('ListIdentifiers');
			describe.skip('ListMetadataFormats');
			describe.skip('ListRecords');
			describe.skip('ListSets');
		}); */

		describe('privileged', () => {
			describe.skip('GetRecord');
			describe.skip('Identify');
			describe.skip('ListIdentifiers');
			describe.skip('ListMetadataFormats');
			describe('ListRecords', generateTestSuite('bib', 'privileged', 'ListRecords'));
			describe.skip('ListSets');
		});
	});

	describe('aut-names', () => {
		describe('unprivileged', () => {
			it.skip('Should return an error because of a bad verb');

			describe.skip('GetRecord');
			describe.skip('Identify');
			describe.skip('ListIdentifiers');
			describe.skip('ListMetadataFormats');
			describe.skip('ListRecords');
			describe.skip('ListSets');
		});

		describe('privileged', () => {
			it.skip('Should return an error because of a bad verb');

			describe.skip('GetRecord');
			describe.skip('Identify');
			describe.skip('ListIdentifiers');
			describe.skip('ListMetadataFormats');
			describe.skip('ListRecords');
			describe.skip('ListSets');
		});
	});

	describe('aut-subjects', () => {
		describe('unprivileged', () => {
			it.skip('Should return an error because of a bad verb');

			describe.skip('GetRecord');
			describe.skip('Identify');
			describe.skip('ListIdentifiers');
			describe.skip('ListMetadataFormats');
			describe.skip('ListRecords');
			describe.skip('ListSets');
		});

		describe('privileged', () => {
			it.skip('Should return an error because of a bad verb');

			describe.skip('GetRecord');
			describe.skip('Identify');
			describe.skip('ListIdentifiers');
			describe.skip('ListMetadataFormats');
			describe.skip('ListRecords');
			describe.skip('ListSets');
		});
	});
});
