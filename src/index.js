const gameData = {
    init() {
        // Load previously saved game (if there is one)
        if (loadGame() == null) {
            // Start a new game
            // Retrieve definitions from eleventy's global data directory
            retrieveJSON('data/jobs.json').then(data => {
                this.defs.jobs = data;
            });
            retrieveJSON('data/resources.json').then(data => {
                this.defs.resources = data;
            });
            retrieveJSON('data/buildings.json').then(data => {
                this.defs.buildings = data;
            });
        } else {
            // Load the data
            console.log('Loading...');
            var loadData = loadGame();
            var loadedComponentData = loadData.componentData;
            // Work through each object in the loaded data and replace the current component data with the loaded data
            // TODO: Take into account versions, user may have saved on an older version of the game
            for (key in loadedComponentData) {
                this[key] = loadedComponentData[key];
            }
            // Update last saved element (save functions will do this whenever it saves, this is just to set it initially)
            document.querySelector('#lastSavedText').innerText = prettyDate(loadData.lastSaved);
            console.log('Game loaded from save at', prettyDate(loadData.lastSaved));
        }

        // Setup the time of day progress bar
        this.dayProgressElement = new ldBar('#day-progress', {
            preset: 'fan',
            duration: 1 / this.progressFactor / 2,
            stroke: `data:ldbar/res,gradient(0,${this.secondsInADay},orange,yellow)`,
            'stroke-width': 10,
            precision: '0.0000001',
        });
        this.threatProgressElement = new ldBar('#threat-progress', {
            preset: 'line',
            duration: 1,
            stroke: 'data:ldbar/res,stripe(red,orange,1)',
            'stroke-width': 2,
        });
        this.spawnProgressElement = new ldBar('#spawn-progress', {
            preset: 'line',
            duration: 0.5,
            stroke: 'green',
            'stroke-width': 2,
        });

        // Set initial remainingDaysUntilSpawn
        this.population.remainingDaysUntilSpawn = this.population.daysNeededToSpawn;

        // Set threat level
        this.setThreatLevel();

        // Start timer (do this last)
        this.increaseTime();
    },
    secondsInADay: 5,
    progressFactor: 60, // How many times a second we want the progress bar to be updated (and timer function to be run)
    defs: {},
    jobs: {
        chopper: 0,
        shinebandit: 0,
        catcher: 0,
        snacker: 0,
        watcher: 0,
    },
    resources: {
        wood: 0,
        metal: 0,
        critters: 80,
        snacks: 40,
    },
    buildings: {},
    delta(type, component) {
        if (this.defs.resources != undefined) {
            var resourceJob = this.defs.resources[type].components[component].job;
            var amountGained = this.jobs[resourceJob] * this.defs.jobs[resourceJob].amountGathered;
            var amountConsumed = this.population.total * this.defs.resources[type].components[component].consumption;
            return amountGained - amountConsumed;
        } else {
            return 0;
        }
    },
    totalDelta(type) {
        if (this.defs.resources != undefined) {
            var totalDelta = 0;
            for (const componentID in this.defs.resources[type].components) {
                if (Object.hasOwnProperty.call(this.defs.resources[type].components, componentID)) {
                    const resourceDelta = this.delta(type, componentID);
                    totalDelta += resourceDelta;
                }
            }
        }
        return totalDelta;
    },
    totalResources(type) {
        switch (type) {
            case 'materials':
                return this.resources.wood + this.resources.metal;
                break;
            case 'food':
                return this.resources.critters + this.resources.snacks;
                break;
            default:
                return getTotal(this.resources);
                break;
        }
    },
    population: {
        total: 2,
        max: 15,
        daysNeededToSpawn: 2,
        remainingDaysUntilSpawn: 0,
    },
    spawnSasquatch() {
        this.population.total++;
    },
    numAssigned() {
        return getTotal(this.jobs);
    },
    numIdle() {
        return this.population.total - this.numAssigned();
    },
    changeJob(job, changeType, amount) {
        // Adding to a job
        if (changeType == 'add') {
            // Check if there are enough idle workers
            if (this.numIdle() >= amount) {
                // Add to the job
                this.jobs[job] += amount;
            } else {
                console.log(`Not enough idle workers (only ${this.numIdle()}) to add ${amount} to job ${job}`);
                return 'Not enough idle workers to add to that job';
            }
        } else if (changeType == 'subtract') {
            // Check if there actually are any sasquatches in that job
            if (this.jobs[job] >= amount) {
                // Subtract from the job
                this.jobs[job] -= amount;
            } else {
                console.log(
                    `Not enough workers currently doing job ${job} (only ${this.jobs[job]}) to subtract ${amount}`,
                );
                return 'Not enough workers currently doing that job to subtract that many';
            }
        }
    },
    currentTime: 0,
    increaseTime() {
        setTimeout(() => {
            // console.log(humanReadableProxy(this.currentTime))
            this.currentTime += 1 / this.progressFactor;
            this.dayProgressElement.set((this.currentTime / this.secondsInADay) * 100);
            if (this.currentTime >= this.secondsInADay) {
                this.endOfDay();
            }
            this.increaseTime();
        }, 1000 / this.progressFactor);
    },
    endOfDay() {
        // console.log('end of day reached');
        // Reset day time
        this.currentTime = 0;
        this.dayProgressElement.set(0);

        // Add resources
        this.resources.wood += this.delta('materials', 'wood');
        this.resources.metal += this.delta('materials', 'metal');
        this.resources.critters += this.delta('food', 'critters');
        this.resources.snacks += this.delta('food', 'snacks');

        // Handle spawning
        if (this.population.total < this.population.max) {
            if (this.population.remainingDaysUntilSpawn == 0) {
                // Reset remainingDaysUntilSpawn counter
                this.population.remainingDaysUntilSpawn = this.population.daysNeededToSpawn;
                // Attempt to spawn a new sasquatch
                this.spawnSasquatch();
            } else {
                this.population.remainingDaysUntilSpawn--;
            }
            this.spawnProgressElement.set(
                100 - (this.population.remainingDaysUntilSpawn / this.population.daysNeededToSpawn) * 100,
            );
        }

        // Update threat level
        this.setThreatLevel();

        // Save the game
        saveGame();
    },
    threatLevel: 0,
    threatReduction: 0,
    setThreatLevel() {
        // Prepare empty variables for storing threat level and contributions so we don't mess with the existing values while calculating
        var newThreatLevel = 0;
        var newThreatLevelContributions = [];
        // Calculate job increases
        for (jobID in this.defs.jobs) {
            const job = this.defs.jobs[jobID];
            if (this.jobs[jobID] > 0 && job.threatIncrease != 0) {
                newThreatLevel += job.threatIncrease * this.jobs[jobID];
                newThreatLevelContributions.push({
                    description: `${job.name}s are increasing threat by ${this.jobs[jobID] * job.threatIncrease}%`,
                    each: `(${job.threatIncrease}% each)`,
                });
            }
        }
        // Calculate reductions
        if (this.threatReduction != 0) {
            newThreatLevel -= this.threatReduction;
            newThreatLevelContributions.push({
                description: `Buildings are decreasing threat by ${this.threatReduction}%`,
            });
        }
        // Apply new values
        this.threatLevel = newThreatLevel;
        this.threatLevelContributions = newThreatLevelContributions;
        // Update the progress bar
        this.threatProgressElement.set(newThreatLevel);
    },
    threatLevelContributions: [],
    dayProgressElement: null,
    threatProgressElement: null,
    spawnProgressElement: null,
    build(buildingID) {
        // Check if can afford
        var canAfford = true;
        var cantAffordResources = [];
        for (materialID in this.defs.resources.materials.components) {
            if (this.defs.buildings[buildingID].cost[materialID] >= this.resources[materialID]) {
                canAfford = false;
                cantAffordResources.push(this.defs.resources.materials.components[materialID].name);
            }
        }

        if (canAfford === true) {
            // Remove resources
            for (resource in this.defs.buildings[buildingID].cost) {
                this.resources[resource] -= this.defs.buildings[buildingID].cost[resource];
            }
            // Add building
            this.buildings[buildingID] ? this.buildings[buildingID]++ : (this.buildings[buildingID] = 1);
            // Apply building effects
            for (effect in this.defs.buildings[buildingID].effects) {
                var effectValue = this.defs.buildings[buildingID].effects[effect];
                console.log(effect, effectValue);
                switch (effect) {
                    case 'increasePopulation':
                        this.population.max += effectValue;
                        break;
                    case 'decreaseThreat':
                        this.threatReduction += effectValue;
                        this.setThreatLevel();
                        break;
                    default:
                        console.log('Effect ' + effect + ' for building ID ' + buildingID + ' not defined');
                        break;
                }
            }
        } else {
            var errorResources = cantAffordResources.join(' or '); // Put this in separate variable as Prettier splits the expression across multiple lines when inside a template literal
            console.log(`Can't afford building, not enough ${errorResources}`);
        }
    },
};

function getTotal(obj) {
    return Object.values(obj).reduce((a, b) => a + b);
}

async function retrieveJSON(fileDir) {
    return await fetch(fileDir).then(response => {
        return response.json();
    });
}

function saveGame() {
    console.log('Saving...');
    // Get relevant save data
    var componentData = {};
    for (key in gameData) {
        if (
            typeof gameData[key] != 'function' &&
            !(gameData[key] instanceof ldBar) &&
            key !== 'currentTime' &&
            key[0] != '$'
        ) {
            componentData[key] = gameData[key];
        }
    }
    // Update last save timestamp
    var lastSaved = new Date();
    localStorage.setItem('last_saved', lastSaved);
    // Encrypt the save data
    var encryptedSave = window.simpleEncryptor.encrypt(componentData);
    // console.log(encryptedSave);
    // Store the save data
    localStorage.setItem('save_string', encryptedSave);
    // Dispatch an event with the last saved date so Alpine can do things
    window.dispatchEvent(new CustomEvent('gamesaved', { detail: lastSaved }));
    console.log('Game saved at', prettyDate(lastSaved));
}

function loadGame() {
    // Load and decode the saved data
    var saveString = localStorage.getItem('save_string');
    var lastSaved = new Date(localStorage.getItem('last_saved'));
    if (saveString == null) {
        return null;
    } else {
        // console.log(saveString)
        // Decrypt the save data
        var decryptedSave = window.simpleEncryptor.decrypt(saveString);
        return {
            componentData: decryptedSave,
            lastSaved: lastSaved,
        };
    }
}

function wipeGame() {
    localStorage.setItem('save_string', null);
    location.reload();
}

function prettyDate(dateObj) {
    if (typeof dateObj == 'object') {
        return (
            dateObj.toDateString() +
            ' ' +
            dateObj.getHours() +
            ':' +
            ('0' + dateObj.getMinutes()).slice(-2) +
            ':' +
            ('0' + dateObj.getSeconds()).slice(-2)
        );
    } else {
        return 'No saves yet, or last save not a date object';
    }
}

document.addEventListener('alpine:init', () => {
    Alpine.store('navFunctions', {
        saveGameClicked() {
            saveGame();
        },
        newGameClicked() {
            wipeGame();
        },
    });
});

document.addEventListener('alpine:init', () => {
    Alpine.store('modals', {
        toggleModal(modalID) {
            this[modalID].open = !this[modalID].open;
        },
        help: {
            open: false,
            title: 'Help',
            content:
                'You are responsible for a tribe of sasquatches. It is your job to assign the sasquatches their roles and expand the tribe, while ensuring their survival. But watch out! Your wards rely on a nearby human settlemen for some vital food and resources, but they must not be alerted to your presence - if your tribe is revealed, all is lost!',
        },
        faq: {
            open: false,
            title: 'FAQ',
            content:
                "<p class='faq-question'>What is a sasquatch?</p>" +
                "<p>You may know them by another name - bigfoot! You can read more about our large-footed cousins here: <a href='https://en.wikipedia.org/wiki/Bigfoot'>https://en.wikipedia.org/wiki/Bigfoot</a></p>" +
                "<p class='faq-question'>How do I play this game?</p>" +
                "<p>This is an idle incremental game - that is, the game plays itself! You make changes to various things (like the jobs each sasquatch has) and the game runs itself accordingly. It even runs while you are away! But be careful not to leave it too long, or your sasquatches may grow in population to the point where they exhaust their food supplies. Keep a watchful eye on things and you'll do fine!</p>" +
                "<p class='faq-question'>There are no pictures in this game.</p>" +
                '<p>To keep things simple I opted for a minimal, text-based interface. Down the track I would love to build a visual component that changes as you play.</p>' +
                "<p class='faq-question'>How and why did you make this?</p>" +
                '<p>I love idle incremental games, and I have been learning to build sites using Eleventy, Alpine and Tailwind. I thought this would be a fun way to take these two passions and meld them together. This is still very much in beta so the game will definitely change over time!</p>' +
                "<p class='faq-question'>Can I check out the code?</p>" +
                "<p>Sure thing! You can find the code repo on Github here: <a href='https://github.com/zapscribbles/secret-sasquatch'>https://github.com/zapscribbles/secret-sasquatch</a></p>" +
                "<p class='faq-question'>I have questions.</p>" +
                '<p>And I have answers! Feel free to email me at stephen.zappia@gmail.com and I will gladly answer them.</p>' +
                '',
        },
    });
});
