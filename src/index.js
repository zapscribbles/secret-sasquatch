function gameData() {
	return {
		init() {

			// Load previously saved game (if there is one)
			if (loadGame() == null) {
				// Start a new game
				// Retrieve definitions from eleventy's global data directory
				retrieveJSON("data/jobs.json").then((data) => {
					this.defs.jobs = data;
				});
				retrieveJSON("data/resources.json").then((data) => {
					this.defs.resources = data;
				});
			} else {
				// Load the data
				loadGameClicked();
			}

			// Setup the time of day progress bar
			this.dayProgressElement = new ldBar("#day-progress", {
				preset: "fan",
				duration: 1 / this.progressFactor / 2,
				stroke: `data:ldbar/res,gradient(0,${this.secondsInADay},orange,yellow)`,
				"stroke-width": 10,
				precision: "0.0000001",
			});
			this.threatProgressElement = new ldBar("#threat-progress", {
				preset: "line",
				duration: 1,
				stroke: "data:ldbar/res,stripe(red,orange,1)",
				"stroke-width": 2,
			});
			this.spawnProgressElement = new ldBar("#spawn-progress", {
				preset: "line",
				duration: 0.5,
				stroke: "green",
				"stroke-width": 2,
			});

			// Start timer (do this last)
			this.increaseTime();
		},
		secondsInADay: 2,
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
		delta(type, component) {
			if (this.defs.resources != undefined) {
				var resourceJob =
					this.defs.resources[type].components[component].job;
				var amountGained =
					this.jobs[resourceJob] *
					this.defs.jobs[resourceJob].amountGathered;
				var amountConsumed =
					this.population.total *
					this.defs.resources[type].components[component].consumption;
				return amountGained - amountConsumed;
			} else {
				return 0;
			}
		},
		totalDelta(type) {
			if (this.defs.resources != undefined) {
				var totalDelta = 0;
				for (const componentID in this.defs.resources[type]
					.components) {
					if (
						Object.hasOwnProperty.call(
							this.defs.resources[type].components,
							componentID
						)
					) {
						const resourceDelta = this.delta(type, componentID);
						totalDelta += resourceDelta;
					}
				}
			}
			return totalDelta;
		},
		totalResources(type) {
			switch (type) {
				case "materials":
					return this.resources.wood + this.resources.metal;
					break;
				case "food":
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
			daysNeededToSpawn: 5,
			remainingDaysUntilSpawn: 5,
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
			if (changeType == "add") {
				// Check if there are enough idle workers
				if (this.numIdle() >= amount) {
					// Add to the job
					this.jobs[job] += amount;
				} else {
					console.log(
						`Not enough idle workers (only ${this.numIdle()}) to add ${amount} to job ${job}`
					);
					return "Not enough idle workers to add to that job";
				}
			} else if (changeType == "subtract") {
				// Check if there actually are any sasquatches in that job
				if (this.jobs[job] >= amount) {
					// Subtract from the job
					this.jobs[job] -= amount;
				} else {
					console.log(
						`Not enough workers currently doing job ${job} (only ${this.jobs[job]}) to subtract ${amount}`
					);
					return "Not enough workers currently doing that job to subtract that many";
				}
			}
		},
		currentTime: 0,
		increaseTime() {
			setTimeout(() => {
				// console.log(humanReadableProxy(this.currentTime))
				this.currentTime += 1 / this.progressFactor;
				this.dayProgressElement.set(
					(this.currentTime / this.secondsInADay) * 100
				);
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
			this.resources.wood += this.delta("materials", "wood");
			this.resources.metal += this.delta("materials", "metal");
			this.resources.critters += this.delta("food", "critters");
			this.resources.snacks += this.delta("food", "snacks");

			// Handle spawning
			if (this.population.total < this.population.max) {
				if (this.population.remainingDaysUntilSpawn == 0) {
					// Reset remainingDaysUntilSpawn counter
					this.population.remainingDaysUntilSpawn =
						this.population.daysNeededToSpawn;
					// Attempt to spawn a new sasquatch
					this.spawnSasquatch();
				} else {
					this.population.remainingDaysUntilSpawn--;
				}
				this.spawnProgressElement.set(
					100 -
						(this.population.remainingDaysUntilSpawn /
							this.population.daysNeededToSpawn) *
							100
				);
			}

			// Update threat level
			this.setThreatLevel();
		},
		threatLevel: 0,
		setThreatLevel() {
			// Calulcate the threat level
			var newThreatLevel = 0;
			for (const jobID in this.defs.jobs) {
				if (Object.hasOwnProperty.call(this.defs.jobs, jobID)) {
					const job = this.defs.jobs[jobID];
					newThreatLevel += job.threatIncrease * this.jobs[jobID];
				}
			}
			this.threatLevel = newThreatLevel;
			// Update the progress bar
			this.threatProgressElement.set(newThreatLevel);
		},
		dayProgressElement: null,
		threatProgressElement: null,
		spawnProgressElement: null,
		saveGameClicked() {
			console.log("Saving...");
			saveGame();
			console.log("Game saved.");
		},
		loadGameClicked() {
			console.log("Loading...");
			var loadedComponentData = loadGame();
			// Work through each object in the loaded data and replace the current component data with the loaded data
			// TODO: Take into account versions, user may have saved on an older version of the game
			for (key in loadedComponentData) {
				this[key] = loadedComponentData[key];
			}
			console.log("Game loaded.");
		},
		newGameClicked() {
			wipeGame();
		},
	};
}

function getTotal(obj) {
	return Object.values(obj).reduce((a, b) => a + b);
}

async function retrieveJSON(fileDir) {
	return await fetch(fileDir).then((response) => {
		return response.json();
	});
}

function saveGame() {
	var componentData = document
		.querySelector("#game-container")
		.__x.getUnobservedData();
	for (key in componentData) {
		if (
			typeof componentData[key] == "function" ||
			componentData[key] instanceof ldBar ||
			key === "currentTime"
		) {
			delete componentData[key];
		}
	}
	var encryptedSave = window.simpleEncryptor.encrypt(componentData);
	console.log(encryptedSave);
	localStorage.setItem("save_string", encryptedSave);
}

function loadGame() {
	// Load and decode the saved data
	var saveString = localStorage.getItem("save_string");
	if (saveString == null) {
		return null;
	} else {
		// console.log(saveString)
		var decryptedSave = window.simpleEncryptor.decrypt(saveString);
		return decryptedSave;
	}
}

function wipeGame() {
	localStorage.setItem("save_string", null);
	location.reload();
}
