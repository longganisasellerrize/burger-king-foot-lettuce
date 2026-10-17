/**
 * SAMPLE DATA FOR DEMONSTRATION ONLY.
 *
 * Everything produced here is fictional: the section, teacher, students,
 * attendance, and classroom activities are placeholders used to demonstrate
 * the prototype. Names are generic placeholders, every ID is prefixed with
 * "SAMPLE", and the UI shows a "Sample data" banner while this dataset is
 * loaded. Nothing here represents actual Bagong Silang High School records.
 *
 * The dataset is generated relative to the date it is first loaded, so the
 * calendar always has recent history plus upcoming deadlines to explore.
 * Generation is deterministic (seeded PRNG) for repeatable demos.
 */
import { addDays, isWeekend, fromISODate, todayISO } from '../lib/date';
import type {
  Activity,
  AttendanceRecord,
  AttendanceSession,
  AttendanceStatus,
  Database,
  ISODate,
  ProgressEntry,
  Section,
  Student,
  Teacher,
} from './types';

export const DB_VERSION = 1;

export const SAMPLE_SECTION_ID = 'SAMPLE-SEC-11A';
export const SAMPLE_TEACHER_ID = 'SAMPLE-T-001';
/** The student account used for the guided demo (has recorded absences). */
export const DEMO_STUDENT_ID = 'SAMPLE-2026-0001';

/** Mulberry32: tiny deterministic PRNG. */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STUDENT_NAMES: [string, string, 'M' | 'F'][] = [
  ['Juan', 'Dela Cruz', 'M'],
  ['Maria', 'Santos', 'F'],
  ['Angelo', 'Bautista', 'M'],
  ['Bea', 'Villanueva', 'F'],
  ['Carlo', 'Mendoza', 'M'],
  ['Danica', 'Ramos', 'F'],
  ['Enzo', 'Garcia', 'M'],
  ['Faith', 'Aquino', 'F'],
  ['Gabriel', 'Torres', 'M'],
  ['Hannah', 'Castillo', 'F'],
  ['Ivan', 'Navarro', 'M'],
  ['Jasmine', 'Flores', 'F'],
];

interface Topic {
  title: string;
  description: string;
  notes?: string;
  activity?: { title: string; format: Activity['format']; description: string };
  assignment?: { title: string; instructions: string };
}

/** Topic sequences per subject, roughly following the SHS core curriculum. */
const CURRICULUM: Record<string, Topic[]> = {
  'General Mathematics': [
    {
      title: 'Functions as Models of Real-Life Situations',
      description: 'Defined functions and relations, and modeled real-life situations (e.g. jeepney fare, mobile load) using piecewise functions.',
      notes: 'Remember the vertical line test. Review: domain and range.',
      activity: { title: 'Board work: Is it a function?', format: 'seatwork', description: 'Students identified whether given mappings, tables, and graphs represent functions.' },
    },
    {
      title: 'Evaluating Functions',
      description: 'Evaluated functions at given values, including piecewise functions.',
      assignment: { title: 'Worksheet 1: Evaluating Functions', instructions: 'Answer items 1–15 on the worksheet. Show complete solutions. Submit on paper.' },
    },
    {
      title: 'Operations on Functions',
      description: 'Performed addition, subtraction, multiplication, and division of functions.',
      activity: { title: 'Pair work: Function operations relay', format: 'group', description: 'Pairs solved a chain of function operations; each answer was the input for the next item.' },
    },
    {
      title: 'Composition of Functions',
      description: 'Solved composite functions f(g(x)) and interpreted them in context.',
      notes: 'f(g(x)) is generally NOT equal to g(f(x)).',
    },
    {
      title: 'Rational Functions, Equations, and Inequalities',
      description: 'Distinguished rational functions, rational equations, and rational inequalities.',
      assignment: { title: 'Problem Set: Rational Equations', instructions: 'Solve the 10 rational equations in the problem set. Check for extraneous solutions.' },
    },
    {
      title: 'Solving Rational Inequalities',
      description: 'Solved rational inequalities using the sign-chart method.',
      activity: { title: 'Seatwork: Sign charts', format: 'seatwork', description: 'Individual seatwork on solving five rational inequalities using sign charts.' },
    },
    {
      title: 'Inverse Functions',
      description: 'Determined inverses of one-to-one functions and verified them by composition.',
    },
    {
      title: 'Exponential Functions',
      description: 'Represented real-life situations (population growth, half-life) using exponential functions.',
      assignment: { title: 'Reflection: Exponential growth around us', instructions: 'Write one paragraph describing a real-life example of exponential growth or decay.' },
    },
    {
      title: 'Logarithmic Functions',
      description: 'Introduced logarithms as inverses of exponential functions and the laws of logarithms.',
    },
    {
      title: 'Simple and Compound Interest',
      description: 'Computed simple and compound interest, maturity value, and present value.',
      activity: { title: 'Group task: Savings plan', format: 'group', description: 'Groups compared savings options using simple vs. compound interest.' },
    },
  ],
  'Earth and Life Science': [
    {
      title: 'Origin of the Universe and the Solar System',
      description: 'Discussed the Big Bang theory and hypotheses on the formation of the solar system.',
      activity: { title: 'Video analysis worksheet', format: 'individual', description: 'Students answered guide questions after a short documentary.' },
    },
    {
      title: "Earth's Subsystems",
      description: 'Described the geosphere, hydrosphere, atmosphere, and biosphere and how they interact.',
      assignment: { title: 'Concept map: Earth subsystems', instructions: 'Create a concept map showing at least 6 interactions between the subsystems.' },
    },
    {
      title: 'Minerals and Rocks',
      description: 'Identified common rock-forming minerals using their physical properties.',
      activity: { title: 'Laboratory: Mineral identification', format: 'laboratory', description: 'Groups tested sample minerals for luster, streak, and hardness. Lab report to follow.' },
      notes: 'Bring the lab manual next meeting.',
    },
    {
      title: 'Weathering and Erosion',
      description: 'Explained physical and chemical weathering and agents of erosion.',
    },
    {
      title: 'Plate Tectonics',
      description: 'Explained plate boundaries and the processes at divergent, convergent, and transform boundaries.',
      activity: { title: 'Practical: Plate boundary model', format: 'practical', description: 'Groups built a simple model to demonstrate plate movement.' },
    },
    {
      title: 'Earthquakes and Faults',
      description: 'Discussed faults, seismic waves, and earthquake preparedness.',
      notes: 'Review the Duck, Cover, and Hold procedure for the earthquake drill.',
      assignment: { title: 'Family earthquake plan', instructions: 'Prepare a one-page earthquake preparedness plan for your household.' },
    },
    {
      title: 'Volcanoes',
      description: 'Classified volcanoes and described volcanic hazards.',
    },
    {
      title: 'Geologic Time Scale',
      description: 'Described how rock layers and fossils are used to establish relative age.',
      activity: { title: 'Timeline activity', format: 'group', description: 'Groups arranged major events on a scaled geologic timeline.' },
    },
  ],
  'Oral Communication': [
    {
      title: 'Nature and Elements of Communication',
      description: 'Defined communication and discussed its elements: sender, message, channel, receiver, feedback, context.',
    },
    {
      title: 'Models of Communication',
      description: 'Compared linear, interactive, and transactional models of communication.',
      activity: { title: 'Group diagram: Communication models', format: 'group', description: 'Each group illustrated one communication model using a real-life scenario.' },
    },
    {
      title: 'Communication Breakdown',
      description: 'Identified barriers to effective communication and strategies to avoid them.',
      assignment: { title: 'Journal entry: A misunderstanding', instructions: 'Describe a communication breakdown you experienced and how it could have been avoided (150–200 words).' },
    },
    {
      title: 'Intercultural Communication',
      description: 'Discussed cultural sensitivity and the development of intercultural competence.',
    },
    {
      title: 'Types of Speech Context',
      description: 'Distinguished intrapersonal, interpersonal, public, and mass communication.',
      activity: { title: 'Role play: Speech contexts', format: 'group', description: 'Groups performed short role plays for each speech context.' },
    },
    {
      title: 'Types of Speech Style',
      description: 'Discussed frozen, formal, consultative, casual, and intimate speech styles.',
    },
    {
      title: 'Speech Acts',
      description: 'Explained locutionary, illocutionary, and perlocutionary acts.',
      assignment: { title: 'Speech act identification', instructions: 'Identify the speech acts in the 10 dialogue excerpts provided.' },
    },
    {
      title: 'Principles of Speech Writing',
      description: 'Discussed audience analysis, purpose, topic selection, and outlining a speech.',
      notes: 'Start drafting your speech for the performance task.',
    },
  ],
  'Komunikasyon at Pananaliksik': [
    {
      title: 'Mga Konseptong Pangwika',
      description: 'Tinalakay ang kahulugan ng wika, wikang pambansa, wikang opisyal, at wikang panturo.',
    },
    {
      title: 'Register at Barayti ng Wika',
      description: 'Inilarawan ang iba’t ibang barayti ng wika: dayalek, sosyolek, idyolek, at iba pa.',
      activity: { title: 'Pangkatang gawain: Barayti ng wika', format: 'group', description: 'Nagbigay ang bawat pangkat ng halimbawa ng bawat barayti ng wika.' },
    },
    {
      title: 'Gamit ng Wika sa Lipunan',
      description: 'Tinalakay ang mga tungkulin ng wika ayon kay M.A.K. Halliday.',
      assignment: { title: 'Sanaysay: Gamit ng wika', instructions: 'Sumulat ng maikling sanaysay (100–150 salita) tungkol sa gamit ng wika sa iyong pamilya.' },
    },
    {
      title: 'Kasaysayan ng Wikang Pambansa',
      description: 'Binalikan ang mahahalagang pangyayari sa pagbuo ng wikang pambansa.',
    },
    {
      title: 'Kakayahang Komunikatibo',
      description: 'Tinalakay ang kakayahang lingguwistiko, sosyolingguwistiko, at pragmatiko.',
      activity: { title: 'Indibidwal na gawain: Pagsusuri ng diyalogo', format: 'individual', description: 'Sinuri ang isang diyalogo batay sa kakayahang komunikatibo.' },
    },
  ],
  'Understanding Culture, Society and Politics': [
    {
      title: 'Starting Points for Understanding Culture, Society, and Politics',
      description: 'Introduced anthropology, sociology, and political science as disciplines.',
    },
    {
      title: 'Defining Culture and Society',
      description: 'Discussed the characteristics and elements of culture.',
      activity: { title: 'Gallery walk: Elements of culture', format: 'group', description: 'Groups presented visual examples of material and non-material culture.' },
    },
    {
      title: 'Ethnocentrism and Cultural Relativism',
      description: 'Compared ethnocentrism and cultural relativism using local examples.',
      assignment: { title: 'Reflection paper: Cultural relativism', instructions: 'Write a reflection (200 words) on a cultural practice different from your own.' },
    },
    {
      title: 'Socialization and Enculturation',
      description: 'Explained how individuals learn norms and values through agents of socialization.',
    },
    {
      title: 'Norms, Values, and Social Control',
      description: 'Distinguished folkways, mores, and laws, and forms of social control.',
    },
  ],
  'Physical Education and Health': [
    {
      title: 'Exercise for Fitness: FITT Principle',
      description: 'Discussed frequency, intensity, time, and type of exercise.',
      activity: { title: 'Practical: Fitness assessment', format: 'practical', description: 'Students performed baseline fitness tests (sit-and-reach, push-ups, 3-minute step test).' },
    },
    {
      title: 'Personal Fitness Goals',
      description: 'Set SMART fitness goals based on fitness test results.',
      assignment: { title: 'Fitness log (1 week)', instructions: 'Record your daily physical activities for one week using the provided log sheet.' },
    },
    {
      title: 'Healthy Eating Habits',
      description: 'Discussed nutrition and the Pinggang Pinoy guide.',
    },
  ],
};

/** Subjects recorded on each weekday (1 = Monday … 5 = Friday). */
const WEEKLY_SCHEDULE: Record<number, string[]> = {
  1: ['General Mathematics', 'Earth and Life Science'],
  2: ['Oral Communication', 'Komunikasyon at Pananaliksik'],
  3: ['General Mathematics', 'Understanding Culture, Society and Politics'],
  4: ['Earth and Life Science', 'Oral Communication'],
  5: ['Physical Education and Health', 'General Mathematics'],
};

/** Next school day strictly after `date`, plus `extra` more school days. */
function schoolDaysAfter(date: ISODate, count: number): ISODate {
  let d = date;
  let n = 0;
  while (n < count) {
    d = addDays(d, 1);
    if (!isWeekend(d)) n++;
  }
  return d;
}

function atTime(date: ISODate, hours: number, minutes: number): number {
  const d = fromISODate(date);
  d.setHours(hours, minutes, 0, 0);
  return d.getTime();
}

export function createSeedDatabase(today: ISODate = todayISO()): Database {
  const rand = prng(20261020);
  const now = Date.now();

  const section: Section = {
    id: SAMPLE_SECTION_ID,
    name: 'Grade 11 – STEM A (Sample Section)',
    gradeLevel: 11,
    schoolYear: 'SY 2026–2027',
    adviserId: SAMPLE_TEACHER_ID,
  };

  const teacher: Teacher = {
    id: SAMPLE_TEACHER_ID,
    title: 'Ms.',
    firstName: 'Sample',
    lastName: 'Adviser',
    subjects: Object.keys(CURRICULUM),
    sectionIds: [SAMPLE_SECTION_ID],
    email: 'sample.adviser@example.edu',
  };

  const students: Student[] = STUDENT_NAMES.map(([firstName, lastName, gender], i) => ({
    id: `SAMPLE-2026-${String(i + 1).padStart(4, '0')}`,
    firstName,
    lastName,
    gender,
    sectionId: SAMPLE_SECTION_ID,
    guardian: 'Sample Guardian',
    email: `${firstName.toLowerCase()}.sample@example.edu`,
  }));

  // ---- Past school days (about 6 weeks of history, excluding today) ----
  const pastDays: ISODate[] = [];
  for (let offset = 42; offset >= 1; offset--) {
    const d = addDays(today, -offset);
    if (!isWeekend(d)) pastDays.push(d);
  }

  const activities: Activity[] = [];
  let actSeq = 0;
  const addActivity = (a: Omit<Activity, 'id' | 'sectionId' | 'createdBy' | 'createdAt' | 'updatedAt'>) => {
    actSeq++;
    const created = atTime(a.date, 8, 0);
    activities.push({
      id: `SAMPLE-ACT-${String(actSeq).padStart(4, '0')}`,
      sectionId: SAMPLE_SECTION_ID,
      createdBy: SAMPLE_TEACHER_ID,
      createdAt: created,
      updatedAt: created,
      ...a,
    });
    return activities[activities.length - 1];
  };

  const topicIndex: Record<string, number> = {};
  const meetingCount: Record<string, number> = {};
  const classDays = [...pastDays, ...(isWeekend(today) ? [] : [today])];

  classDays.forEach((date, dayIdx) => {
    const weekday = fromISODate(date).getDay();
    for (const subject of WEEKLY_SCHEDULE[weekday] ?? []) {
      const topics = CURRICULUM[subject];
      const idx = topicIndex[subject] ?? 0;
      topicIndex[subject] = idx + 1;
      meetingCount[subject] = (meetingCount[subject] ?? 0) + 1;
      const topic = topics[idx % topics.length];

      addActivity({
        date,
        type: 'lesson',
        subject,
        title: topic.title,
        description: topic.description,
        notes: topic.notes,
        materials: [{ label: `${subject} – Module slides: ${topic.title}` }],
      });
      if (topic.activity) {
        addActivity({
          date,
          type: 'activity',
          subject,
          title: topic.activity.title,
          description: topic.activity.description,
          format: topic.activity.format,
        });
      }
      if (topic.assignment) {
        addActivity({
          date,
          type: 'assignment',
          subject,
          title: topic.assignment.title,
          description: `Take-home work for the lesson "${topic.title}".`,
          instructions: topic.assignment.instructions,
          dueDate: schoolDaysAfter(date, 3),
          materials: [{ label: `${topic.assignment.title} (printed handout)` }],
        });
      }
      // Short quiz every 4th meeting of a subject.
      if (meetingCount[subject] % 4 === 0) {
        addActivity({
          date,
          type: 'quiz',
          subject,
          title: `Quiz: ${topics[(idx + topics.length - 1) % topics.length].title}`,
          description: 'A 15-item quiz covering the previous lessons was conducted in class.',
          notes: 'Students who were absent should coordinate with the teacher for a make-up quiz.',
        });
      }
    }

    // Friday homeroom announcements.
    if (weekday === 5) {
      addActivity({
        date,
        type: 'announcement',
        subject: 'Homeroom / Advisory',
        title: 'Weekly homeroom reminders',
        description: 'Reminders on proper uniform, cleanliness of the classroom, and checking pending requirements before the weekend.',
      });
    }
    // An occasional schedule change.
    if (dayIdx === pastDays.length - 7) {
      addActivity({
        date,
        type: 'announcement',
        subject: 'Homeroom / Advisory',
        title: 'Schedule change: Shortened afternoon classes',
        description: 'Afternoon classes will end at 2:00 PM next Wednesday due to a faculty meeting (sample announcement).',
        scheduleChange: true,
      });
    }
  });

  // ---- Larger items: performance task, exams, and events ----
  const ptaskDate = pastDays[pastDays.length - 6] ?? today;
  addActivity({
    date: ptaskDate,
    type: 'performance_task',
    subject: 'Oral Communication',
    title: 'Performance Task: Informative Speech (3–5 minutes)',
    description: 'Deliver an informative speech on a community issue. Graded using the speech delivery rubric.',
    instructions: 'Submit your speech outline first, then deliver the speech in class on the deadline. Rubric: content 40%, organization 20%, delivery 30%, time 10%.',
    dueDate: schoolDaysAfter(today, 6),
    materials: [{ label: 'Speech delivery rubric (handout)' }, { label: 'Sample speech outline' }],
  });

  const recentAbsenceCandidate = pastDays[pastDays.length - 2] ?? today;
  addActivity({
    date: recentAbsenceCandidate,
    type: 'performance_task',
    subject: 'Earth and Life Science',
    title: 'Performance Task: Hazard Map of Our Barangay',
    description: 'In groups of four, create a hazard map identifying earthquake, flood, and landslide risk areas in your community.',
    instructions: 'Use the provided map template. Include a legend and three safety recommendations. Group leaders submit the output.',
    dueDate: schoolDaysAfter(today, 4),
  });

  const examAnnounceDay = pastDays[pastDays.length - 4] ?? today;
  const examDay = schoolDaysAfter(today, 8);
  addActivity({
    date: examAnnounceDay,
    type: 'announcement',
    subject: 'Homeroom / Advisory',
    title: 'First Quarter Examination schedule released',
    description: `The quarterly examinations start on ${examDay}. Review all lessons from the start of the quarter.`,
    notes: 'Settle all requirements before the exam week.',
  });
  addActivity({
    date: examDay,
    type: 'exam',
    subject: 'General Mathematics',
    title: 'First Quarter Examination – General Mathematics',
    description: 'Covers functions, rational functions, inverse, exponential, and logarithmic functions.',
    notes: 'Bring a scientific calculator and a black/blue ballpen.',
  });
  addActivity({
    date: schoolDaysAfter(examDay, 1),
    type: 'exam',
    subject: 'Earth and Life Science',
    title: 'First Quarter Examination – Earth and Life Science',
    description: 'Covers the origin of the universe through the geologic time scale.',
  });
  addActivity({
    date: schoolDaysAfter(today, 3),
    type: 'quiz',
    subject: 'Komunikasyon at Pananaliksik',
    title: 'Quiz: Barayti at Gamit ng Wika (scheduled)',
    description: 'Scheduled 20-item quiz on varieties and functions of language.',
  });
  addActivity({
    date: schoolDaysAfter(today, 2),
    type: 'event',
    subject: 'Homeroom / Advisory',
    title: 'Earthquake Drill (Sample Event)',
    description: 'School-wide earthquake drill during the second period. Follow the evacuation route posted in the classroom.',
  });
  addActivity({
    date: schoolDaysAfter(today, 12),
    type: 'event',
    subject: 'Homeroom / Advisory',
    title: 'Parent–Teacher Conference (Sample Event)',
    description: 'Distribution of first quarter progress reports. Parents/guardians are invited to attend.',
  });
  const pastEventDay = pastDays[pastDays.length - 12];
  if (pastEventDay) {
    addActivity({
      date: pastEventDay,
      type: 'event',
      subject: 'Homeroom / Advisory',
      title: 'Class Officers Election (Sample Event)',
      description: 'The section elected its class officers for the school year.',
    });
  }

  // ---- Attendance: one closed morning session per past school day ----
  const sessions: AttendanceSession[] = [];
  const records: AttendanceRecord[] = [];
  const n = pastDays.length;
  // Fixed absences for the demo student so the missed-activities feature has content.
  const demoAbsent = new Set([pastDays[n - 2], pastDays[n - 9], pastDays[n - 19]].filter(Boolean));
  const demoLate = new Set([pastDays[n - 5], pastDays[n - 14]].filter(Boolean));

  pastDays.forEach((date, i) => {
    const sessionId = `SAMPLE-SES-${date}`;
    const openedAt = atTime(date, 7, 15);
    sessions.push({
      id: sessionId,
      sectionId: SAMPLE_SECTION_ID,
      date,
      label: 'Morning homeroom',
      openedAt,
      graceMinutes: 15,
      closedAt: atTime(date, 8, 0),
      token: `sample${i}`,
      createdBy: SAMPLE_TEACHER_ID,
    });
    for (const s of students) {
      let status: AttendanceStatus;
      if (s.id === DEMO_STUDENT_ID) {
        status = demoAbsent.has(date) ? 'absent' : demoLate.has(date) ? 'late' : 'present';
      } else {
        const r = rand();
        status = r < 0.05 ? 'absent' : r < 0.06 ? 'excused' : r < 0.12 ? 'late' : 'present';
      }
      const minute =
        status === 'late' ? 31 + Math.floor(rand() * 20) : status === 'present' ? Math.floor(rand() * 30) : 45;
      records.push({
        id: `SAMPLE-REC-${date}-${s.id}`,
        sessionId,
        studentId: s.id,
        sectionId: SAMPLE_SECTION_ID,
        date,
        status,
        recordedAt: atTime(date, 7, minute),
        method: 'sample',
        note: status === 'excused' ? 'Excuse letter submitted (sample)' : undefined,
      });
    }
  });

  // ---- Sample progress for the demo student's older missed activities ----
  const progress: ProgressEntry[] = [];
  const oldest = pastDays[n - 19];
  const middle = pastDays[n - 9];
  for (const a of activities) {
    if (a.date === oldest && a.type !== 'announcement' && a.type !== 'event') {
      progress.push({ studentId: DEMO_STUDENT_ID, activityId: a.id, status: 'completed', updatedAt: now });
    }
    if (a.date === middle && a.type === 'lesson') {
      progress.push({ studentId: DEMO_STUDENT_ID, activityId: a.id, status: 'in_progress', updatedAt: now });
    }
  }

  return {
    version: DB_VERSION,
    isSampleData: true,
    seededAt: now,
    sections: [section],
    students,
    teachers: [teacher],
    sessions,
    records,
    activities,
    progress,
  };
}
