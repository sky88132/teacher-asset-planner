import {createSimpleInputs} from '../../src/lib/simple/model.ts';
import {createPensionEstimateInput} from '../../src/lib/simple/pension-types.ts';
// Fictional dates and amounts; only coarse condition categories guide case B.
// No exact birth/appointment dates or identifying information came from the user.
export const pensionDisplayBasis='2026-11-09';
export function pensionDisplayCase(id){
 const f=createSimpleInputs();f.profile.military='not';
 Object.assign(f.profile,id==='A'?{birthDate:'1987-02-12',appointmentDate:'2017-04-01',step:'20',promotionMonth:'4',retirement:'early',earlyDate:'2039-08-31'}:
   {birthDate:'1985-06-15',appointmentDate:'2010-03-01',step:'26',promotionMonth:'3',retirement:'normal'});
 f.benefits.civil.pensionEstimate=createPensionEstimateInput();
 if(id==='B')Object.assign(f.profile,{birthDate:'1988-07-18',appointmentDate:'2016-03-01',step:'24',military:'approved'});
 if(id==='C')Object.assign(f.benefits.civil.pensionEstimate,{incomeMode:'current',confirmedAppointmentDate:'2010-03-01',confirmedRetirementDate:'2047-08-31'});
 return f;
}
