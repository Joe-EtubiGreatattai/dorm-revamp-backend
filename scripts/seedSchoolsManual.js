require('dotenv').config();
const mongoose = require('mongoose');
const School = require('../models/School');

const schoolsList = [
    // Federal Universities
    "Abubakar Tafawa Balewa University, Bauchi",
    "Adeyemi Federal University of Education, Ondo",
    "Admiralty University Ibusa, Delta",
    "Ahmadu Bello University, Zaria",
    "Air Force Institute of Technology, Kaduna",
    "Alex Ekwueme Federal University Ndufu Alike Ikwo, Ebonyi",
    "Alvan Ikoku Federal University of Education, Owerri",
    "Bayero University, Kano",
    "Federal University Birnin Kebbi, Kebbi",
    "Federal University Dutse, Jigawa",
    "Federal University Dutsin-Ma, Katsina",
    "Federal University Gashua, Yobe",
    "Federal University Gusau, Zamfara",
    "Federal University Kashere, Gombe",
    "Federal University Lokoja, Kogi",
    "Federal University Lafia, Nasarawa",
    "Federal University of Agriculture, Abeokuta",
    "Federal University of Agriculture, Zuru",
    "Federal University of Applied Sciences Kachia, Kaduna",
    "Federal University of Education, Pankshi, Plateau",
    "Federal University of Education, Zaria, Kaduna",
    "Federal University of Health Sciences, Azare, Bauchi",
    "Federal University of Petroleum Resources Effurun, Delta",
    "Federal University of Technology Akure, Ondo",
    "Federal University of Technology Minna, Niger",
    "Federal University of Technology Owerri, Imo",
    "Federal University of Transportation, Daura, Katsina",
    "Federal University Otuoke, Bayelsa",
    "Federal University Oye-Ekiti, Ekiti",
    "Federal University Wukari, Taraba",
    "Joseph Sarwuan Tarka University, Makurdi",
    "Michael Okpara University of Agriculture, Umudike",
    "Modibbo Adama University, Yola",
    "National Open University of Nigeria, Lagos/Abuja",
    "Nigeria Police Academy, Wudil",
    "Nigerian Army University, Biu",
    "Nigerian Defense Academy, Kaduna",
    "Nigerian Maritime University, Okerenkoko",
    "Nnamdi Azikiwe University, Awka",
    "Obafemi Awolowo University, Ile-Ife",
    "Tai Solarin Federal University of Education, Ijebu-Ode",
    "University of Abuja, Gwagwalada",
    "University of Benin, Benin City",
    "University of Calabar, Calabar",
    "University of Ibadan, Ibadan",
    "University of Ilorin, Ilorin",
    "University of Jos, Jos",
    "University of Lagos, Akoka",
    "University of Maiduguri, Maiduguri",
    "University of Nigeria, Nsukka",
    "University of Port Harcourt, Port Harcourt",
    "University of Uyo, Uyo",
    "Usmanu Danfodiyo University, Sokoto",
    "Yusuf Maitama Sule Federal University of Education, Kano",

    // State Universities
    "Abdulkadir Kure University, Minna",
    "Abia State University, Uturu",
    "Adamawa State University, Mubi",
    "Adekunle Ajasin University, Akungba-Akoko",
    "Akwa Ibom State University, Uyo",
    "Aliko Dangote University of Science and Technology, Wudil",
    "Ambrose Alli University, Ekpoma",
    "Bauchi State University, Gadau",
    "Bayelsa Medical University, Yenagoa",
    "Benue State University, Makurdi",
    "Borno State University, Maiduguri",
    "Bukar Abba Ibrahim University, Damaturu",
    "Chukwuemeka Odumegwu Ojukwu University, Uli",
    "University of Cross River State, Calabar",
    "Delta State University, Abraka",
    "Delta State University of Science and Technology, Ozoro",
    "Dennis Osadebay University, Asaba",
    "Ebonyi State University, Abakaliki",
    "Edo State University, Uzairue",
    "Ekiti State University, Ado Ekiti",
    "Enugu State University of Science and Technology, Enugu",
    "Gombe State University, Gombe",
    "Gombe State University of Science and Technology, Kumo",
    "Ibrahim Badamasi Babangida University, Lapai",
    "Ignatius Ajuru University of Education, Port Harcourt",
    "Imo State University, Owerri",
    "Kingsley Ozumba Mbadiwe University, Ideato South",
    "Kaduna State University, Kaduna",
    "Kebbi State University of Science and Technology, Aliero",
    "Prince Abubakar Audu University, Anyigba",
    "Kwara State University, Malete",
    "Ladoke Akintola University of Technology, Ogbomoso",
    "Lagos State University, Ojo",
    "Lagos State University of Education, Ijanikin",
    "Lagos State University of Science and Technology, Ikorodu",
    "Nasalawa State University, Keffi",
    "Niger Delta University, Amassoma",
    "Olabisi Onabanjo University, Ago-Iwoye",
    "Olusegun Agagu University of Science and Technology, Okitipupa",
    "Osun State University, Osogbo",
    "Plateau State University, Bokkos",
    "Rivers State University, Port Harcourt",
    "Sule Lamido University, Kafin-Hausa",
    "Tai Solarin University of Education, Ijebu Ode",
    "Taraba State University, Jalingo",
    "Umaru Musa Yar'adua University, Katsina",
    "Sokoto State University, Sokoto",
    "University of Delta, Agbor",
    "Yusuf Maitama Sule University, Kano",
    "Zamfara State University, Talata Mafara",

    // Private Universities
    "Achievers University, Owo",
    "Adeleke University, Ede",
    "Afe Babalola University, Ado-Ekiti",
    "African University of Science and Technology, Abuja",
    "Ahman Pategi University, Pategi",
    "Ajayi Crowther University, Oyo",
    "Al-Ansar University, Maiduguri",
    "Al-Hikmah University, Ilorin",
    "Al-Qalam University, Katsina",
    "American University of Nigeria, Yola",
    "Anchor University, Ayobo",
    "Arthur Jarvis University, Akpabuyo",
    "Ave Maria University, Piyanko",
    "Babcock University, Ilishan-Remo",
    "Baze University, Abuja",
    "Bells University of Technology, Ota",
    "Benson Idahosa University, Benin City",
    "Bowen University, Iwo",
    "Bingham University, Karu",
    "Caleb University, Ikorodu",
    "Caritas University, Enugu",
    "CETEP City University, Yaba",
    "Chrisland University, Abeokuta",
    "Christopher University, Mowe",
    "Clifford University, Owerrinta",
    "Coal City University, Enugu",
    "Covenant University, Ota",
    "Crawford University, Igbesa",
    "Crescent University, Abeokuta",
    "Dominican University, Ibadan",
    "Edwin Clark University, Kiagbodo",
    "Elizade University, Ilara-Mokin",
    "Evangel University, Akaeze",
    "Fountain University, Osogbo",
    "Godfrey Okoye University, Enugu",
    "Greenfield University, Kaduna",
    "Gregory University, Uturu",
    "Hallmark University, Ijebu-Itele",
    "Hezekiah University, Umudi",
    "Igbinedion University, Okada",
    "Joseph Ayo Babalola University, Ikeji-Arakeji",
    "Khadija University, Majia",
    "Kings University, Odeomu",
    "Koladaisi University, Ibadan",
    "Kwararafa University, Wukari",
    "Landmark University, Omu-Aran",
    "Lead City University, Ibadan",
    "Madonna University, Elele/Okija",
    "McPherson University, Seriki-Setayo",
    "Mewar University, Masaka",
    "Michael and Cecilia Ibru University, Agbara-Otor",
    "Mountain Top University, Makogi Oba",
    "Mudiame University, Irrua",
    "Nile University of Nigeria, Abuja",
    "Nok University, Kachia",
    "Novena University, Ogume",
    "Obong University, Obong Ntak",
    "Oduduwa University, Ipetumodu",
    "PAMO University of Medical Sciences, Port Harcourt",
    "Pan-Atlantic University, Lekki",
    "Paul University, Awka",
    "Peaceland University, Enugu",
    "Precious Cornerstone University, Ibadan",
    "Redeemer's University Nigeria, Ede",
    "Renaissance University, Ugbawka",
    "Rhema University, Aba",
    "Ritman University, Ikot Ekpene",
    "Salem University, Lokoja",
    "Sam Maris University, Supare",
    "Samuel Adegboyega University, Ogwa",
    "Skyline University, Kano",
    "Summit University, Offa",
    "Veritas University, Bwari",
    "Wesley University, Ondo",
    "Western Delta University, Oghara",
    "Westland University, Iwo",
    "University of Mkar, Mkar",
    "James Hope University, Lekki"
];

const seedSchools = async () => {
    try {
        const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dorm';
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        let count = 0;
        let skipped = 0;

        for (const schoolName of schoolsList) {
            try {
                const normalizedName = schoolName.trim();
                const exists = await School.findOne({ name: normalizedName });
                if (!exists) {
                    await School.create({ name: normalizedName });
                    count++;
                } else {
                    skipped++;
                }
            } catch (err) {
                console.error(`Error saving school: ${schoolName}`, err.message);
            }
        }

        console.log(`Summary: Seeding complete.`);
        console.log(`✅ ${count} schools added.`);
        console.log(`ℹ️ ${skipped} schools already existed.`);

        process.exit(0);
    } catch (error) {
        console.error('Seeding failed:', error);
        process.exit(1);
    }
};

seedSchools();
