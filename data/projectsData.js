// projectsData.js
const projects = [
    {
      id: 1,
      title: "Project SwordBreak",
      image: "/images/swordBreak.png",
      description: "Project Swordbreak is a action-adventure game built in Unreal Engine. Key technical highlights include a custom-built randomizer system, custom localization system, and an advanced character controller.",
      link: "https://legendaryepics.itch.io/project-swordbreak",
      technologies: [
        { name: "Unreal Engine", color: "#ffffffff" },
        { name: "C++", color: "#0091ffff" },
        { name: "Blueprints", color: "#0066CC" },
      ]
    },
    {
      id: 2,
      title: "Neon Knight",
      image: "/images/neonKnight.png",
      description: "This project was my entry for the 2023 Epic MegaJam. It is a fast-paced third-person bullet-hell. It features a custom Niagara particle collision system.",
      link: "https://legendaryepics.itch.io/neon-knight",
      technologies: [
        { name: "Unreal Engine", color: "#ffffffff" },
        { name: "Niagara", color: "#a800f7ff" },
        { name: "C++", color: "#0091ffff" },
      ]
    },
    {
      id: 3,
      title: "Music Library App",
      image: "/images/musicLib.png",
      description: "This is a public-facing web application I built for The Church of Jesus Christ of Latter-day Saints. It features a React frontend with a Node.js middleware layer. Deployed on AWS, it leverages services such as CloudFront, API Gateway, AWS Lambda, and S3 for scalability and high performance.",
      link: "https://www.churchofjesuschrist.org/media/music?lang=eng",
      technologies: [
        { name: "React", color: "#00bef3ff" },
        { name: "Node.js", color: "#339933" },
        { name: "AWS Lambda", color: "#FF9900" },
        { name: "CloudFront", color: "#FF9900" },
        { name: "API Gateway", color: "#FF9900" },
        { name: "S3", color: "#FF9900" }
      ]
    },
    {
      id: 4,
      title: "Project ISO",
      image: "/images/projectIso.png",
      description: "????",
      link: "",
      technologies: []
    },
    {
      id: 5,
      title: "MapList UE5 Plugin",
      image: "/images/unrealcpp.png",
      description: "An UE5 plugin I built to list all maps in a project for quick navigation.",
      link: "https://github.com/dylanjp/UE5-MapList-Plugin",
      technologies: [
        { name: "Unreal Engine", color: "#ffffffff" },
        { name: "Plugin Development", color: "#ffffffff"  },
        { name: "C++", color: "#0091ffff" },
      ]
    }
    // Add more project objects here
  ];
  
  export default projects;
  