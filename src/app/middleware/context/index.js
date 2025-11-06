import bib from './bib.js';
import autNames from './aut-names.js';
import autSubjects from './aut-subjects.js';
import autWorks from './aut-works.js';
import autAux from './aut-auxiliary.js';

export default ({contextName, ...params}) => {
  const map = {bib, autNames, autSubjects, autWorks, autAux};
  return map[contextName](params);
};
