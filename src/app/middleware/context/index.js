import bib from './bib';
import autNames from './aut-names';
import autSubjects from './aut-subjects';
import autWorks from './aut-works';
import autAux from './aut-auxiliary';

export default ({contextName, ...params}) => {
  const map = {bib, autNames, autSubjects, autWorks, autAux};
  return map[contextName](params);
};
