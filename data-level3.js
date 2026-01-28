window.LEVEL3 = {
  image: {
    url: "assets/v1.png",
    width: 3312,
    height: 2019
  },

  // Optional: blocks for understanding (not used for routing)
  blocks: {
    A:  { x: 410,  y: 670  },
    B:  { x: 1090, y: 430  },
    C:  { x: 1930, y: 470  },
    D:  { x: 2670, y: 454  },
    E:  { x: 1186, y: 1030 },
    F:  { x: 1902, y: 1014 },
    G:  { x: 2722, y: 1074 },
    H:  { x: 1914, y: 1487 },
    IH: { x: 2374, y: 1567 },
    J:  { x: 3010, y: 786  }
  },

  hallway: {
    nodes: {
      H01: { x: 89,  y: 919 },
      H02: { x: 239, y: 920 },
      H03: { x: 297, y: 940 },
      H04: { x: 338, y: 903 },
      H05: { x: 263, y: 836 },
      H06: { x: 274, y: 784 },
      H07: { x: 554, y: 513 },
      H08: { x: 736, y: 517 },
      H09: { x: 231, y: 845 },
      H10: { x: 83,  y: 836 }
    },
    edges: [
      ["H01","H10"],
      ["H01","H02"],
      ["H02","H03"],
      ["H03","H04"],
      ["H04","H05"],
      ["H05","H09"],
      ["H09","H10"],
      ["H05","H06"],
      ["H06","H07"],
      ["H07","H08"],
      ["H08","H04"]
    ]
  },

  // Rooms start with null coords; you will click-place them
  rooms: [
  {"code": "MCA 311","x": 252,"y": 772},
  {"code": "MCA 330","x": 498,"y": 524},
  {"code": "MCA 306","x": 129,"y": 860},
  {"code": "MCA 304","x": 102,"y": 855},
  {"code": "MCA 305","x": 104,"y": 822},
  {"code": "MCA 307","x": 120,"y": 824},
  {"code": "MCA 310","x": 215,"y": 828},
  {"code": "MCA 313","x": 289,"y": 745},
  {"code": "MCA 316","x": 308,"y": 726},
  {"code": "MCA 317","x": 331,"y": 704},
  {"code": "MCA 318","x": 355,"y": 679},
  {"code": "MCA 320","x": 374,"y": 659},
  {"code": "MCA 321","x": 397,"y": 638},
  {"code": "MCA 322","x": 420,"y": 616},
  {"code": "MCA 324","x": 441,"y": 593},
  {"code": "MCA 326","x": 462,"y": 571},
  {"code": "MCA 328","x": 488,"y": 547},
  {"code": "MCA 331","x": 528,"y": 505},
  {"code": "MCA 312","x": 293,"y": 795},
  {"code": "MCA 314","x": 310,"y": 780},
  {"code": "MCA 338","x": 369,"y": 840},
  {"code": "MCA 315","x": 359,"y": 731},
  {"code": "MCA 319","x": 414,"y": 678},
  {"code": "MCA 323","x": 498,"y": 710},
  {"code": "MCA 325","x": 488,"y": 605},
  {"code": "MCA 327","x": 513,"y": 582},
  {"code": "MCA 329","x": 533,"y": 556},
  {"code": "MCA 334","x": 571,"y": 538},
  {"code": "MCA 332","x": 554,"y": 487},
  {"code": "MCA 333","x": 578,"y": 488},
  {"code": "MCA 335","x": 609,"y": 488},
  {"code": "MCA 336","x": 667,"y": 489},
  {"code": "MCA 302","x": 184,"y": 1056},
  {"code": "MCA 300","x": 217,"y": 1162},
  {"code": "MCA 303","x": 230,"y": 892}
  ],

  pois: [
    { id: "WR_1", label: "Female Washroom", type: "washroom",x: 648,y: 566},
    { id: "WR_2", label: "Male Washroom", type: "washroom", x: 527,y: 684 }
  ]
};

