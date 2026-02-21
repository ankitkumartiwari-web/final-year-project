import { motion } from 'motion/react';
import { ThreeDModelViewer } from './ThreeDModelViewer';
import { lowPolyModelUrl } from '../assets/lowPolyModel';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { useState, useRef, useEffect } from 'react';
import { HistoricalEvent } from './EventSelectionScreen';
import { Character } from './CharacterSelectionScreen';
import { AlertCircle, Sparkles } from 'lucide-react';

interface StoryGameplayScreenProps {
  event: HistoricalEvent;
  character: Character;
  onRestart: () => void;
}

interface StorySegment {
  text: string;
  type: 'narrative' | 'hint' | 'success';
}

const storyData: Record<string, Record<string, { intro: string; scenarios: Record<string, { correct: string[]; hint: string; success: string }> }>> = {
  'mauryan-empire': {
    ashoka: {
      intro: `You are Emperor Ashoka, ruler of the vast Mauryan Empire. The year is 261 BCE. Your armies stand ready at the borders of Kalinga, a prosperous kingdom that has refused to submit to your rule. Your generals await your command. The fate of thousands rests in your hands.`,
      scenarios: {
        'attack kalinga': {
          correct: ['attack kalinga', 'attack', 'wage war', 'march to kalinga'],
          hint: 'Historically, Ashoka waged war on Kalinga, but the bloodshed deeply affected him.',
          success: `Your armies march into Kalinga. The battle is fierce and brutal. As you survey the battlefield afterward, you see the rivers running red with blood. Over 100,000 soldiers and civilians lie dead. The victory is yours, but at what cost? The sight fills you with remorse. What will you do now?`,
        },
        'embrace peace': {
          correct: ['embrace peace', 'choose peace', 'adopt buddhism', 'renounce violence', 'spread dhamma'],
          hint: 'After the Kalinga War, Ashoka was transformed. He adopted Buddhism and promoted peace.',
          success: `You publicly renounce violence and embrace the path of Dhamma. You send missionaries across the empire and beyond to spread Buddhism. You erect pillars inscribed with edicts promoting tolerance, compassion, and moral governance. Your transformation from a warrior to a peace-loving emperor becomes legendary, inspiring generations to come.`,
        },
      },
    },
    soldier: {
      intro: `You are a soldier in Emperor Ashoka's army, preparing to march into Kalinga in 261 BCE. You've fought in many campaigns to expand the Mauryan Empire. Your commander orders the troops to advance. The Kalingan forces are said to be fierce defenders of their homeland. You grip your sword tightly as drums signal the march.`,
      scenarios: {
        'charge forward': {
          correct: ['charge', 'attack', 'advance', 'fight', 'march forward'],
          hint: 'The Mauryan army fought bravely, but the battle was devastating for both sides.',
          success: `You charge into battle alongside thousands of soldiers. The fighting is brutal and unrelenting. You witness unimaginable carnage as soldiers on both sides fall. After days of fierce combat, Kalinga is conquered, but the battlefield is a sea of blood. You see the emperor himself surveying the destruction, his face filled with profound sorrow. This victory has come at a terrible cost.`,
        },
        'question the war': {
          correct: ['question', 'doubt', 'hesitate', 'think', 'reflect'],
          hint: 'Many soldiers witnessed the horrific aftermath and were deeply affected by the violence.',
          success: `You pause and look around at the devastation. Women and children flee in terror, homes burn, and the cries of the wounded fill the air. You begin to question the purpose of this conquest. Is territorial expansion worth such suffering? Your doubts mirror those of the emperor himself, who will soon renounce warfare and embrace the path of peace, transforming the empire's values forever.`,
        },
      },
    },
    monk: {
      intro: `You are a Buddhist monk traveling through the Mauryan Empire in 260 BCE, shortly after the Kalinga War. Emperor Ashoka has summoned Buddhist scholars to the palace. Word spreads that the emperor, haunted by the carnage he witnessed, seeks spiritual guidance. You have been invited to share the teachings of the Buddha with him.`,
      scenarios: {
        'teach dhamma': {
          correct: ['teach', 'share teachings', 'explain buddhism', 'preach dhamma', 'guide emperor'],
          hint: 'Buddhist monks played a crucial role in Ashoka\'s transformation and the spread of Buddhism.',
          success: `You teach Emperor Ashoka about the Four Noble Truths and the path of non-violence. Your words resonate deeply with the emperor, who is tormented by guilt over the Kalinga War. He embraces Buddhism wholeheartedly and vows to rule according to Dhamma. The emperor asks you to help establish Buddhist monasteries across the empire.`,
        },
        'organize missions': {
          correct: ['organize', 'send missionaries', 'spread buddhism', 'establish monasteries', 'travel abroad'],
          hint: 'Ashoka sent Buddhist missions to Sri Lanka, Southeast Asia, and even the Mediterranean.',
          success: `With Emperor Ashoka's patronage, you help organize missions to spread Buddhism far beyond India's borders. Monks travel to Sri Lanka, where Ashoka's son Mahinda establishes the religion. Missions reach as far as Greece and Egypt. The emperor erects rock edicts and pillars inscribed with Buddhist principles. Your efforts help Buddhism become a world religion, transforming it from a regional teaching to an international force for peace.`,
        },
      },
    },
    minister: {
      intro: `You are a senior minister in Emperor Ashoka's court in 261 BCE. The empire has just achieved victory over Kalinga, but the emperor seems changed. Instead of celebrating, he wanders the palace corridors at night, unable to sleep. He has summoned the council to discuss a radical new direction for the empire. This could change everything.`,
      scenarios: {
        'support transformation': {
          correct: ['support', 'agree', 'endorse change', 'help emperor', 'embrace dhamma'],
          hint: 'Ashoka\'s ministers had to adapt to his new philosophy of governance based on Dhamma.',
          success: `You publicly support the emperor's decision to govern by Dhamma rather than force. Together, you work to implement policies based on moral persuasion, welfare, and tolerance. You establish hospitals for humans and animals, plant trees along roads, and dig wells for public use. You help draft edicts promoting religious harmony and non-violence. Your administrative skills help transform the empire from a military power into a model of ethical governance.`,
        },
        'reform administration': {
          correct: ['reform', 'create policies', 'establish welfare', 'implement dhamma', 'build infrastructure'],
          hint: 'Ashoka\'s reign saw significant administrative reforms focused on public welfare.',
          success: `You spearhead administrative reforms throughout the empire. You establish a network of officials called Dhamma Mahamatras to promote moral values and resolve disputes peacefully. You oversee the construction of rest houses, hospitals, and veterinary clinics. Roads are improved and trees planted for shade. Water wells are dug in arid regions. Your reforms create a welfare state that prioritizes the well-being of all subjects, becoming a model for future civilizations.`,
        },
      },
    },
  },
  'revolt-1857': {
    sepoy: {
      intro: `You are a sepoy in the Bengal Army, stationed at Meerut. It is May 1857. Rumors spread that the new rifle cartridges are greased with cow and pig fat, offensive to both Hindu and Muslim soldiers. Your fellow sepoys are refusing to use them. British officers have imprisoned 85 soldiers for disobedience. Tension fills the air. What will you do?`,
      scenarios: {
        'join the rebellion': {
          correct: ['join rebellion', 'rebel', 'rise up', 'fight', 'revolt'],
          hint: 'Many sepoys joined the rebellion, sparking the first war of independence.',
          success: `You and your fellow soldiers rise in rebellion! You free the imprisoned soldiers and march toward Delhi. The rebellion spreads like wildfire across northern India. You fight alongside Rani Lakshmibai and other leaders. Though the uprising will eventually be suppressed, your courage inspires future generations in the freedom struggle.`,
        },
        'organize resistance': {
          correct: ['organize', 'plan', 'strategize', 'unite soldiers', 'gather forces'],
          hint: 'Organization and unity were crucial to the rebellion\'s initial success.',
          success: `You secretly organize meetings with other sepoys. Together, you coordinate plans to rise simultaneously across multiple garrisons. Your strategic thinking helps unite Hindu and Muslim soldiers in a common cause. The coordinated uprising catches the British off guard, giving the rebellion crucial early momentum.`,
        },
      },
    },
    leader: {
      intro: `You are a respected leader in Delhi, May 1857. Rebellious sepoys from Meerut have arrived at the city gates, having freed imprisoned soldiers and killed British officers. They proclaim the aged Mughal emperor Bahadur Shah Zafar as their symbolic leader and seek your support. The people look to you for guidance. The British East India Company's rule hangs in the balance.`,
      scenarios: {
        'rally the people': {
          correct: ['rally', 'unite people', 'organize revolt', 'lead uprising', 'mobilize'],
          hint: 'Leaders across north India rallied their people to join the cause against British rule.',
          success: `You rally the citizens of Delhi to support the rebellion. Craftsmen, merchants, and common people join the sepoys. You organize the defense of the city and coordinate with other regional leaders like Rani Lakshmibai of Jhansi, Nana Sahib, and Kunwar Singh. Delhi becomes the symbolic heart of the uprising. Though British forces will eventually recapture the city, the rebellion spreads across Awadh, Bihar, and Central India, shaking the foundations of colonial rule.`,
        },
        'coordinate strategy': {
          correct: ['coordinate', 'plan defense', 'strategize', 'organize forces', 'unite regions'],
          hint: 'Coordination between different regions was essential for the rebellion\'s strength.',
          success: `You work tirelessly to coordinate between different rebel groups. You send messengers to Lucknow, Kanpur, and Jhansi to synchronize actions. You help establish supply lines and organize the rebel administration in Delhi. Your strategic planning allows the rebellion to sustain itself for months. Though ultimately unsuccessful, the organized resistance demonstrates the possibility of unified Indian action against British rule, planting seeds for future independence movements.`,
        },
      },
    },
    civilian: {
      intro: `You are a village elder in rural Awadh, June 1857. News arrives that sepoys have rebelled against the British and that the revolt is spreading. British officials have fled the region. Rebel soldiers are moving through villages, seeking support. Your community faces a crucial decision: remain neutral or join the cause. As elder, your counsel will guide your people.`,
      scenarios: {
        'support rebellion': {
          correct: ['support', 'help rebels', 'provide aid', 'join cause', 'assist fighters'],
          hint: 'Many villages provided crucial support to the rebellion through supplies and shelter.',
          success: `You persuade the village to support the rebellion. Your community provides food, shelter, and medical aid to rebel fighters. Young men volunteer to join the cause. Women contribute by preparing supplies. Your village becomes a safe haven for freedom fighters. Though the British will later impose harsh penalties on rebel villages, your community's sacrifice becomes part of the proud legacy of resistance against colonial oppression.`,
        },
        'protect community': {
          correct: ['protect', 'defend village', 'organize defense', 'safeguard people', 'ensure safety'],
          hint: 'Village elders had to balance supporting the cause with protecting their communities.',
          success: `You organize the village's defenses while discreetly supporting the rebellion. You establish a warning system to protect civilians when British troops approach. You hide rebel soldiers and share information about British troop movements. Your careful approach helps the village survive the conflict while contributing to the resistance. After the rebellion, your wisdom in protecting the community while maintaining dignity and resistance is remembered for generations.`,
        },
      },
    },
    messenger: {
      intro: `You are a trusted messenger serving local leaders during the 1857 uprising. It is August 1857. You carry critical information about British troop movements from Delhi to rebel forces in Kanpur. The journey is dangerous—British patrols are everywhere, and getting caught means certain execution. But the information you carry could save hundreds of rebel lives.`,
      scenarios: {
        'deliver message': {
          correct: ['deliver', 'travel', 'reach kanpur', 'complete mission', 'journey'],
          hint: 'Messengers played a vital role in coordinating the rebellion across vast distances.',
          success: `You navigate through dangerous territory, avoiding British patrols by traveling at night and using forest paths. You disguise yourself as a merchant and hide the message in your turban. After days of careful travel, you reach Kanpur and deliver your message to Nana Sahib's forces. Your intelligence allows the rebels to prepare for a British attack, saving many lives. Your bravery exemplifies the countless unsung heroes who risked everything for freedom.`,
        },
        'gather intelligence': {
          correct: ['gather intelligence', 'spy', 'collect information', 'observe enemy', 'scout'],
          hint: 'Intelligence gathering was crucial for the rebellion\'s tactical decisions.',
          success: `Beyond delivering messages, you observe British military positions, troop strength, and supply routes. You note which Indian soldiers remain loyal to the British and which secretly sympathize with the rebels. You compile detailed reports that help rebel leaders make informed decisions. Your intelligence work contributes to several rebel victories. Though your name will not appear in history books, your role in the information network is vital to the resistance.`,
        },
      },
    },
  },
  'indian-independence': {
    'freedom-fighter': {
      intro: `It is 1930. Mahatma Gandhi has called for the Salt March to protest the British salt tax. You are a young freedom fighter in a coastal village. The British Salt Act makes it illegal to collect or sell salt, forcing Indians to buy heavily taxed British salt. Gandhi plans to march 240 miles to the sea to make salt, defying British law. Will you join this peaceful protest?`,
      scenarios: {
        'join salt march': {
          correct: ['join march', 'march', 'walk with gandhi', 'join protest', 'make salt'],
          hint: 'The Salt March was a powerful act of civil disobedience that inspired millions.',
          success: `You join thousands walking alongside Gandhi to Dandi. After 24 days, you reach the sea. Gandhi picks up a handful of salt, breaking British law. You and others follow suit. News spreads across India and the world. Millions join in making salt. The non-violent protest shakes the British Empire and brings international attention to India's struggle for freedom.`,
        },
        'organize local protests': {
          correct: ['organize protest', 'protest locally', 'boycott salt', 'civil disobedience', 'non-violent resistance'],
          hint: 'Local protests across India amplified the impact of Gandhi\'s movement.',
          success: `You organize peaceful protests in your village. You encourage people to make their own salt and boycott British goods. Women join the movement, making it truly inclusive. Your peaceful persistence in the face of arrests and violence demonstrates the power of non-violent resistance and contributes to the larger freedom movement.`,
        },
      },
    },
    leader: {
      intro: `You are a movement leader in 1942. Gandhi has launched the Quit India Movement demanding immediate British withdrawal from India. "Do or Die" is the rallying cry. The British have arrested all major Congress leaders including Gandhi and Nehru. With leadership decentralized, local leaders like you must keep the movement alive. Police have orders to suppress any protests. What will you do?`,
      scenarios: {
        'lead protests': {
          correct: ['lead protest', 'organize movement', 'rally people', 'demonstrate', 'non-violent resistance'],
          hint: 'The Quit India Movement saw widespread protests despite brutal British suppression.',
          success: `You organize massive protests across your region. Despite police violence and arrests, thousands respond to your call. Students leave schools, workers strike, and entire communities participate in civil disobedience. You are arrested and imprisoned, but the movement continues. The British realize they cannot govern India against the will of its people. Your sacrifice accelerates the timeline toward independence, which arrives in 1947.`,
        },
        'underground resistance': {
          correct: ['underground', 'secret resistance', 'parallel government', 'organize secretly', 'evade police'],
          hint: 'With Congress leaders arrested, an underground movement kept the struggle alive.',
          success: `You go underground and establish a parallel government. You organize secret meetings, distribute pamphlets, and coordinate protests from hiding. You set up communication networks using coded messages. Despite British efforts to capture you, you successfully disrupt colonial administration. Your underground movement demonstrates that even without formal leadership, Indians can organize effectively, proving that independence is inevitable.`,
        },
      },
    },
    student: {
      intro: `You are a college student in Calcutta, 1942. The Quit India Movement has been launched. Your professors have quietly encouraged students to participate in the freedom struggle. The British have arrested Congress leaders and imposed strict curfews. Students across India are debating whether to join protests or continue studies. Your classmates look to you for leadership.`,
      scenarios: {
        'organize student strike': {
          correct: ['strike', 'organize students', 'boycott classes', 'student protest', 'walkout'],
          hint: 'Student movements played a crucial role in the independence struggle.',
          success: `You organize a massive student strike. Thousands of students walk out of classes across Calcutta. You lead peaceful marches carrying the tricolor flag. British police charge with lathis, but students maintain non-violent discipline. Your strike spreads to other cities—Bombay, Madras, Lahore. The student movement demonstrates that India's youth stands united for freedom. Many student leaders are arrested, but your generation's commitment ensures independence will be achieved.`,
        },
        'spread awareness': {
          correct: ['spread awareness', 'educate', 'write pamphlets', 'distribute literature', 'inform people'],
          hint: 'Students used education and awareness to mobilize support for independence.',
          success: `You use your education to spread awareness about India's right to self-rule. You write pamphlets explaining Gandhi's philosophy and the goals of the freedom movement. You organize study circles discussing democratic ideals. You visit villages educating farmers about their rights. Your intellectual approach complements direct action, creating informed citizens ready for independence. The British ban your publications, but they spread through underground networks, inspiring thousands.`,
        },
      },
    },
    journalist: {
      intro: `You are a journalist for an Indian newspaper in 1919, just after the Jallianwala Bagh massacre in Amritsar. General Dyer ordered troops to fire on peaceful protesters, killing hundreds. The British have imposed strict censorship, forbidding any criticism of the massacre. Your editor asks what you will do—follow British censorship or report the truth and risk imprisonment.`,
      scenarios: {
        'report truth': {
          correct: ['report truth', 'publish story', 'expose massacre', 'write article', 'reveal facts'],
          hint: 'Brave journalists risked everything to expose British atrocities and awaken Indian consciousness.',
          success: `You write a detailed account of the massacre, describing how Dyer ordered firing without warning on a trapped crowd. You interview survivors and document the horror. Despite censorship, you publish the truth. Your newspaper is banned and you are arrested, but copies spread across India. International journalists pick up the story. The exposure of British brutality shocks the world and strengthens Indian resolve for independence. Your journalism becomes a weapon for truth and justice.`,
        },
        'mobilize opinion': {
          correct: ['mobilize', 'influence opinion', 'build support', 'rally people', 'create awareness'],
          hint: 'The press played a vital role in building public opinion for independence.',
          success: `You use your platform to mobilize public opinion against British rule. Through carefully worded articles that evade censorship, you document injustices, economic exploitation, and denial of rights. You interview freedom fighters and publish their visions for free India. Your writing inspires people across India to join the independence movement. The British monitor your work closely, but you continue fearlessly. Your pen becomes as powerful as any weapon in the freedom struggle.`,
        },
      },
    },
  },
  'ancient-civilizations': {
    merchant: {
      intro: `You are a merchant in the thriving city of Mohenjo-daro, circa 2500 BCE. Your city is famous for its advanced drainage systems, standardized weights, and prosperous trade. Merchants from Mesopotamia seek your goods. Your warehouse is full of cotton textiles, precious stones, and carved ivory. A caravan is departing for a long journey. What will you do?`,
      scenarios: {
        'trade with mesopotamia': {
          correct: ['trade', 'join caravan', 'export goods', 'establish trade routes', 'travel west'],
          hint: 'The Indus Valley had extensive trade networks with Mesopotamia.',
          success: `You join the caravan westward. After months of travel through dangerous terrain, you reach Mesopotamia. Your cotton and beads are highly valued. You return with precious metals and lapis lazuli. Your successful journey establishes a trade route that will enrich both civilizations for centuries.`,
        },
        'develop local trade': {
          correct: ['trade locally', 'build market', 'expand city', 'standardize weights', 'improve trade'],
          hint: 'The Indus Valley civilization was known for standardized trade practices.',
          success: `You focus on strengthening local trade networks. You work with city officials to maintain the standardized weight system, making trade fair and efficient. Your honest practices make your city a trusted trading hub. The prosperity you help build contributes to the civilization's remarkable longevity.`,
        },
      },
    },
    priest: {
      intro: `You are a Vedic priest during the later Vedic period, around 1000 BCE. You are one of the few who can read and recite the sacred Vedas, passed down orally for generations. A king has invited you to perform a grand yajna (ritual sacrifice) and seeks your counsel on matters of dharma. Your knowledge gives you great influence in society.`,
      scenarios: {
        'preserve vedas': {
          correct: ['preserve', 'teach vedas', 'pass knowledge', 'train students', 'recite hymns'],
          hint: 'Vedic priests preserved sacred knowledge through oral tradition for millennia.',
          success: `You dedicate yourself to preserving the Vedas through oral transmission. You train young brahmins in perfect pronunciation and memorization techniques. You establish a system where students recite verses back to each other, ensuring no errors. Your meticulous methods preserve the Rigveda, Samaveda, Yajurveda, and Atharvaveda for over 3,000 years without written text—a remarkable feat of human memory and dedication.`,
        },
        'guide society': {
          correct: ['guide', 'counsel king', 'teach dharma', 'advise ruler', 'promote righteousness'],
          hint: 'Vedic priests served as spiritual advisors and guardians of social order.',
          success: `You use your position to guide society toward dharma (righteousness). You counsel the king on just governance and the welfare of his people. You conduct rituals that unite the community and teach moral principles. You mediate disputes using Vedic wisdom. Your influence helps establish concepts of duty, justice, and cosmic order that will shape Indian civilization for millennia, eventually influencing the development of Hinduism, Buddhism, and Jainism.`,
        },
      },
    },
    craftsperson: {
      intro: `You are a master craftsperson in Harappa, circa 2600 BCE. You specialize in creating intricate seals with animal motifs and the mysterious Indus script. Your seals are used by merchants for trade and by officials for administrative purposes. The city council has commissioned you to create a special seal for an important trade delegation. Your reputation for precision is renowned.`,
      scenarios: {
        'craft masterpiece': {
          correct: ['craft', 'create seal', 'carve design', 'make seal', 'produce artwork'],
          hint: 'Harappan seals show remarkable artistic skill and standardization.',
          success: `You carve a beautiful seal from steatite stone, featuring a unicorn motif and perfectly formed script characters. The seal is precisely 2x2 inches—the standard size used throughout the Indus Valley. Your craftsmanship is so fine that modern archaeologists will marvel at it 4,500 years later. The seal helps authenticate important trade contracts and becomes a symbol of your civilization's sophistication and artistic achievement.`,
        },
        'train apprentices': {
          correct: ['train', 'teach craft', 'pass skills', 'educate apprentices', 'share knowledge'],
          hint: 'The consistency of Harappan crafts suggests systematic training and knowledge transfer.',
          success: `You establish a workshop school where you train young apprentices in your craft. You teach them to maintain exact proportions, use standardized tools, and create the distinctive Indus script characters. Your systematic teaching creates a tradition of excellence that spans generations. The remarkable uniformity of seals across the entire Indus Valley—from Harappa to Mohenjo-daro—is partly due to training systems like yours, demonstrating advanced social organization.`,
        },
      },
    },
    chief: {
      intro: `You are a tribal chief during the early Vedic period, around 1500 BCE. Your people have recently settled in the fertile plains of the Sapta Sindhu (Land of Seven Rivers). Other tribes compete for the best grazing lands and water sources. You must decide whether to form alliances through marriage and trade, or expand territory through conflict. Your decisions will shape your tribe's future.`,
      scenarios: {
        'form alliances': {
          correct: ['form alliance', 'make peace', 'trade', 'marry', 'cooperate'],
          hint: 'Vedic tribes formed confederations and alliances to ensure mutual prosperity.',
          success: `You arrange marriages between your family and neighboring tribal chiefs, creating bonds of kinship. You establish trade agreements and share grazing rights. During harvest festivals, you invite other tribes for celebrations, strengthening cultural ties. Your peaceful approach creates a confederation of tribes that prosper together. This spirit of cooperation lays the foundation for the later concept of janapadas (republics) and eventually contributes to the idea of unity in diversity that characterizes Indian civilization.`,
        },
        'develop agriculture': {
          correct: ['develop agriculture', 'farm', 'settle', 'cultivate land', 'grow crops'],
          hint: 'The transition from nomadic to settled agricultural life transformed Vedic society.',
          success: `You lead your tribe in transitioning from pastoral nomadism to settled agriculture. You organize the clearing of forests and the cultivation of rice and barley. You establish permanent villages with proper planning. You introduce iron tools that make farming more efficient. Your leadership in adopting agriculture transforms your tribe from wandering herders to settled farmers. This transition helps create surplus food, allowing for specialization of labor, the rise of crafts, and the development of complex social structures that characterize later Vedic civilization.`,
        },
      },
    },
  },
};

export function StoryGameplayScreen({ event, character, onRestart }: StoryGameplayScreenProps) {
  const [story, setStory] = useState<StorySegment[]>([]);
  const [command, setCommand] = useState('');
  const [currentScenario, setCurrentScenario] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const eventStory = storyData[event.id]?.[character.id];
  const scenarios = eventStory ? Object.entries(eventStory.scenarios) : [];

  useEffect(() => {
    // Add intro text
    if (eventStory) {
      setStory([{ text: eventStory.intro, type: 'narrative' }]);
    }
  }, [eventStory]);

  useEffect(() => {
    // Auto-scroll to bottom
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [story]);

  const handleCommand = () => {
    if (!command.trim()) return;

    const userCommand = command.toLowerCase().trim();
    const newStory = [...story, { text: `> ${command}`, type: 'narrative' as const }];

    if (currentScenario < scenarios.length) {
      const [scenarioKey, scenarioData] = scenarios[currentScenario];
      const isCorrect = scenarioData.correct.some((cmd) =>
        userCommand.includes(cmd.toLowerCase())
      );

      if (isCorrect) {
        newStory.push({ text: scenarioData.success, type: 'success' });
        setCurrentScenario(currentScenario + 1);

        if (currentScenario + 1 >= scenarios.length) {
          newStory.push({
            text: `\n✨ Your journey through history is complete! You have witnessed key moments of ${event.title} through the eyes of ${character.name}. The decisions you made reflect the complexities of historical choices.`,
            type: 'success',
          });
        }
      } else {
        newStory.push({ text: scenarioData.hint, type: 'hint' });
      }
    }

    setStory(newStory);
    setCommand('');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
      className="h-screen flex flex-col overflow-hidden"
      style={{
        background: 'linear-gradient(to bottom, #f4e8d0, #e8d4b0)',
        fontFamily: 'Merriweather, serif',
      }}
    >
      {/* Header with background image */}
      <div
        className="relative h-24 md:h-32 flex items-end p-4 md:p-6 flex-shrink-0"
        style={{
          backgroundImage: `url('${event.image}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-amber-900/80" />
        <div className="relative z-10">
          <h2 className="text-amber-50 mb-1 text-xl md:text-2xl" style={{ fontFamily: 'Crimson Text, serif' }}>
            {event.title}
          </h2>
          <p className="text-amber-200 text-sm md:text-base">Playing as: {character.name}</p>
        </div>
      </div>

      {/* Main content area - Side by side on desktop, stacked on mobile */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 md:gap-6 p-4 md:p-6 overflow-hidden">
        {/* Visual Element Area */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="lg:w-2/5 flex-shrink-0 h-48 md:h-64 lg:h-full"
        >
          <div
            className="relative rounded-lg overflow-hidden border-4 border-amber-700/40 shadow-2xl h-full"
            style={{
              backgroundColor: 'rgba(139, 69, 19, 0.1)',
            }}
          >
            {/* Decorative corners */}
            <div className="absolute top-0 left-0 w-6 h-6 md:w-8 md:h-8 border-t-4 border-l-4 border-amber-800 z-10"></div>
            <div className="absolute top-0 right-0 w-6 h-6 md:w-8 md:h-8 border-t-4 border-r-4 border-amber-800 z-10"></div>
            <div className="absolute bottom-0 left-0 w-6 h-6 md:w-8 md:h-8 border-b-4 border-l-4 border-amber-800 z-10"></div>
            <div className="absolute bottom-0 right-0 w-6 h-6 md:w-8 md:h-8 border-b-4 border-r-4 border-amber-800 z-10"></div>

            {/* 3D Model Viewer replaces static image */}
            <div className="relative w-full h-full flex items-center justify-center">
              <ThreeDModelViewer modelUrl={lowPolyModelUrl} />
            </div>

            {/* Caption */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-amber-900/90 to-transparent p-3 md:p-4 z-10"
            >
              <p className="text-amber-100 text-xs md:text-sm italic text-center" style={{ fontFamily: 'Crimson Text, serif' }}>
                {event.title} • {event.period}
              </p>
            </motion.div>
          </div>
        </motion.div>

        {/* Narrative Text Area - Scrollable */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          <div
            ref={scrollRef}
            className="flex-1 space-y-3 md:space-y-4 p-4 md:p-6 rounded-lg border-2 border-amber-600/30 overflow-y-auto"
            style={{
              backgroundColor: 'rgba(250, 246, 239, 0.9)',
            }}
          >
            {story.map((segment, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className={`${
                  segment.type === 'hint'
                    ? 'bg-amber-100 border-l-4 border-amber-600 p-3 md:p-4 rounded'
                    : segment.type === 'success'
                    ? 'bg-green-50 border-l-4 border-green-600 p-3 md:p-4 rounded'
                    : ''
                }`}
              >
                {segment.type === 'hint' && (
                  <div className="flex items-start gap-2 mb-2">
                    <AlertCircle className="w-4 h-4 md:w-5 md:h-5 text-amber-700 flex-shrink-0 mt-1" />
                    <span className="text-amber-900 text-sm md:text-base">Hint:</span>
                  </div>
                )}
                {segment.type === 'success' && (
                  <div className="flex items-start gap-2 mb-2">
                    <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-green-700 flex-shrink-0 mt-1" />
                    <span className="text-green-900 text-sm md:text-base">Success!</span>
                  </div>
                )}
                <p
                  className={`text-sm md:text-base ${
                    segment.type === 'hint'
                      ? 'text-amber-900'
                      : segment.type === 'success'
                      ? 'text-green-900'
                      : 'text-amber-900'
                  } ${segment.text.startsWith('>') ? 'italic text-amber-700' : ''}`}
                >
                  {segment.text}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Command input - Fixed at bottom */}
      <div className="flex-shrink-0 p-4 md:p-6 pt-0">
        <div className="max-w-7xl mx-auto space-y-2 md:space-y-3">
          <div className="flex gap-2 md:gap-3">
            <Input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCommand()}
              placeholder="Type your action (e.g., 'march forward')..."
              className="flex-1 border-2 border-amber-600/50 focus:border-amber-700 bg-amber-50/80 text-sm md:text-base"
              style={{ fontFamily: 'Merriweather, serif' }}
            />
            <Button
              onClick={handleCommand}
              className="px-4 md:px-6 bg-amber-700 hover:bg-amber-800 text-amber-50 text-sm md:text-base"
              style={{ fontFamily: 'Merriweather, serif' }}
            >
              Act
            </Button>
          </div>
          <div className="flex justify-between items-center">
            <p className="text-amber-800 text-xs md:text-sm">
              Enter commands to continue your journey
            </p>
            <Button
              onClick={onRestart}
              variant="outline"
              className="border-amber-600 text-amber-900 hover:bg-amber-100 text-xs md:text-sm"
              style={{ fontFamily: 'Merriweather, serif' }}
            >
              Restart
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}