# Melinda OAI-PMH provider

# About the implementation
- Authoritative source of records is z00. If any of these records don't have an entry in z106, that's an error
  - This was a problem previously when near 100k of records were missing entries in z106. Reason: unknown. Fixed by creating the corresponding entries in z106
      - Should this happen again the problem would manifest itself as OAI-PMH returning less records than it should the flow control would break
- Flow control is based on on [keyset pagination](https://taylorbrazelton.com/posts/2019/03/offset-vs-seek-pagination/).
- When Aleph's headings indexing is in progress, the service doesn't return correct results (For set queries, which use these indexes) because the even though the record data has been updated, the index has not
    - The indexing should be made much more faster. The workaround would be to have a polling service that check the state of the indexing table (z07) and makes the oai-pmh service respond with 503 (Service unavailable) when there is too many rows in the table
- Sets heading indexing specifications should be checked when new indexes are added
- A forked node-oracledb is used because setting charset is not supported and this breaks conversion for characters (Oracle does the unicode conversion for LONG datatypes). Issue is here: https://github.com/oracle/node-oracledb/issues/1172
- Deleted records are not included when harvesting with sets. This is because Aleph's removes deleted records from search indexes.
    - This could be fixed by OAI-PMH checking actual record contents from record history table for deleted records. This would require mapping set configurations to MARC 21 record contents in addition of current index contents.
- Resumption token can be created/decrypted with src/resumption-token-cli (Useful for debugging and creating unit tests)

## License and copyright

Copyright (c) 2019-2020, 2023-2024 **University Of Helsinki (The National Library Of Finland)**

This project's source code is licensed under the terms of **MIT** .
