export enum ESIndexEnum {
  BIOMARKER_INDEX = 'biomarker',
  LAB_BIOMARKER_INDEX = 'lab-biomarker',
  SMPDB_COMPONENTS_INDEX = 'smpdb-components',
}

export interface IBiomarkerES {
  id?: string;
  laboratoryId?: string;
  name: string;
  synonyms: string[];
}
