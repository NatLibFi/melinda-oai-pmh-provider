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

/* eslint-enable max-nested-callbacks */

import chai from 'chai';
import chaiHttp from 'chai-http';
import oracledbMockFactory from './oracledb-mock';
import startApp, {__RewireAPI__ as RewireAPI} from './app'; // eslint-disable-line import/named
import testSuiteFactory from './test-utils';

chai.use(chaiHttp);

describe('app', () => {
	let requester;
	const oracledbMock = oracledbMockFactory();
	const generateTestSuite = testSuiteFactory({
		rootPath: [__dirname, '..', 'test-fixtures'],
		getInterfaces: () => ({requester, oracledbMock})
	});

	RewireAPI.__Rewire__('oracledb', oracledbMock);

	beforeEach(async () => {
		const httpPort = 1337;
		const secretEncryptionKey = 'yuKf7ly1xml33H5+fThvzhdY4XlFMJwQ';

		const name = 'Foo Bar';
		const supportEmail = 'foo@fu.bar';
		const instanceUrl = `http://localhost:${httpPort}`;
		const identifierPrefix = 'oai:foo.bar';
		const maxResults = 5;
		// Tests will break in the 4th millennium
		const resumptionTokenTimeout = 31536000000000;
		const oracleUsername = 'foo';
		const oraclePassword = 'bar';
		const oracleConnectString = 'BAR';

		const app = await startApp({
			httpPort, secretEncryptionKey, instanceUrl,
			name, supportEmail, identifierPrefix,
			maxResults, resumptionTokenTimeout,
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
			describe('Identify', generateTestSuite('bib', 'privileged', 'Identify'));
			describe('ListMetadataFormats', generateTestSuite('bib', 'privileged', 'ListMetadataFormats'));
			describe('ListSets', generateTestSuite('bib', 'privileged', 'ListSets'));
			describe('GetRecord', generateTestSuite('bib', 'privileged', 'GetRecord'));			
			describe.skip('ListIdentifiers');			
			describe('ListRecords', generateTestSuite('bib', 'privileged', 'ListRecords'));			
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
