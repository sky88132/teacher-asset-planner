export type SchoolType = 'public' | 'private';
export type PensionScheme = 'civil' | 'private-school' | 'other' | 'unconfirmed';
export type SpecialCareer = 'military' | 'parental-leave' | 'other-leave' | 'combined-service';

export interface TeacherProfile {
  schoolType: SchoolType;
  birthDate: string;
  appointmentDate: string;
  pension: { scheme: PensionScheme; source: 'school-default' | 'user-selected' };
  hasSpecialCareer: boolean;
  specialCareers: SpecialCareer[];
  specialCareerDetailsEntered: boolean;
}

export const initialProfile: TeacherProfile = {
  schoolType: 'public', birthDate: '', appointmentDate: '',
  pension: { scheme: 'civil', source: 'school-default' },
  hasSpecialCareer: false, specialCareers: [], specialCareerDetailsEntered: false,
};

export function changeSchool(profile: TeacherProfile, schoolType: SchoolType): TeacherProfile {
  return { ...profile, schoolType, pension: profile.pension.source === 'user-selected'
    ? profile.pension
    : { scheme: schoolType === 'public' ? 'civil' : 'private-school', source: 'school-default' } };
}

export function toggleSpecialCareer(profile: TeacherProfile, career: SpecialCareer): TeacherProfile {
  const specialCareers = profile.specialCareers.includes(career)
    ? profile.specialCareers.filter(item => item !== career) : [...profile.specialCareers, career];
  return { ...profile, specialCareers, hasSpecialCareer: specialCareers.length > 0,
    specialCareerDetailsEntered: false };
}
