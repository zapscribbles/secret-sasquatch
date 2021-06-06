var progressFactor = 30; // How many times a second we want the progress bar to be updated (and timer function to be run)

function gameData() {
	return {
		init() {
			// Setup the time of day progress bar
			this.dayProgressElement = new ldBar("#day-progress", {
				preset: "fan",
				duration: 1 / progressFactor / 2,
				stroke: `data:ldbar/res,gradient(0,${this.secondsInADay},orange,yellow)`,
				"stroke-width": 10,
			});

			// Retrieve definitions from eleventy's global data directory
			retrieveJSON("data/jobs.json").then((data) => {
				this.defs.jobs = data;
			});
			retrieveJSON("data/resources.json").then((data) => {
				this.defs.resources = data;
			});

			// Start timer (do this last)
			this.increaseTime();
		},
		defs: {
			jobs: null,
			resources: null,
		},
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
			critters: 0,
			snacks: 0,
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
		numTotal: 10,
		numAssigned() {
			return getTotal(this.jobs);
		},
		numIdle() {
			return this.numTotal - this.numAssigned();
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
		secondsInADay: 2,
		increaseTime() {
			setTimeout(() => {
				// console.log(humanReadableProxy(this.currentTime))
				this.currentTime += 1 / progressFactor;
				this.dayProgressElement.set(
					(this.currentTime / this.secondsInADay) * 100
				);
				if (this.currentTime >= this.secondsInADay) {
					this.endOfDay();
				}
				this.increaseTime();
			}, 1000 / progressFactor);
		},
		endOfDay() {
			// console.log('end of day reached');
			this.currentTime = 0;
			this.dayProgressElement.set(0);
			this.resources.wood += this.jobs.chopper * this.defs.jobs.chopper.amountGathered;
			this.resources.metal += this.jobs.shinebandit * this.defs.jobs.shinebandit.amountGathered;
			this.resources.critters += this.jobs.catcher * this.defs.jobs.catcher.amountGathered;
			this.resources.snacks += this.jobs.snacker * this.defs.jobs.snacker.amountGathered;
		},
		dayProgressElement: null,
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
