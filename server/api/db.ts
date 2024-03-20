
import { DraftPlayer, PlayerInformation, Stats, Timer } from "./types";
import { MongoClient, ServerApiVersion } from "mongodb";
import { connectionUrl } from "./credentials";
import readline from "readline";
import { calculateNumericInning, colorString, draftPlayers, excludedRounds, onlyUnique, sabermetricsURL, splitArray, yearlyPlayers } from "./util";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

async function getInput(): Promise<string> {
    return new Promise((resolve) => {
        rl.question(
            "Do you want to clear all collections before data entry?\n",
            (answer) => {
                resolve(answer.trim().toLowerCase());
            }
        );
    });
}

const client = new MongoClient(connectionUrl, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

const startYear = 2000;
const endYear = 2023;

const mongodb = client.db("MLB");

const playerInfoCollection = mongodb.collection<Document & PlayerInformation>("Player_Info");
const draftCollection = mongodb.collection<Document & DraftPlayer>("Draft_Info");

const fieldingCollection = mongodb.collection("Fielding");
const hittingCollection = mongodb.collection("Hitting");
const pitchingCollection = mongodb.collection("Pitching");

const perPickStatisticsPercentageCollection = mongodb.collection("Per_Pick_Statistics_Percentage");
const perPickPlayerValuePercentageCollection = mongodb.collection("Per_Pick_Player_Value_Percentage");

const perRoundStatisticsPercentageCollection = mongodb.collection("Per_Round_Statistics_Percentage");
const perRoundPlayerValuePercentageCollection = mongodb.collection("Per_Round_Player_Value_Percentage");

const perPickPlayerValueAverageCollection = mongodb.collection("Per_Pick_Player_Value_Average");
const perRoundPlayerValueAverageCollection = mongodb.collection("Per_Round_Player_Value_Average");

export async function tryInitializeDatabase() {
    let clearDB;
    while (clearDB === undefined || clearDB === null) {
        const input = await getInput();
        if (!["yes", "no", "y", "n"].includes(input)) {
            console.log("Invalid response.");
            continue;
        }

        clearDB = ["yes", "y"].includes(input) ? true : false;
    }
    rl.close();

    const timer = new Timer();
    await client.connect();
    if (clearDB) {
        (await mongodb.collections()).forEach(async (c) => {
            if (c.dbName === "MLB" && !["Hitting", "Pitching", "Fielding", "Draft_Info", "Player_Info", "Per_Pick_Statistics_Percentage", "Per_Round_Statistics_Percentage"].includes(c.collectionName)) {
                await c.deleteMany();
            }
        });
    }

    await getDraftInfo();
    await getPlayerInformation();
    await getPlayerStatistics();
    await getPlayerValue();
    await getStatisticPercentages();
    timer.print();
}

function createEmptyStats() {
    return {
        war: 0,
        uzr: 0,
        ops: 0,
        fldPct: 0,
        eraMinus: 0,
        inningsPitched: 0,
        plateAppearances: 0,
        fieldingInnings: 0,
        gamesPlayedHitting: 0,
        gamesPlayedPitching: 0,
        gamesPlayedFielding: 0,
    };
}

async function getStatisticPercentages() {
    if (await perPickStatisticsPercentageCollection.countDocuments() > 0 || await perRoundStatisticsPercentageCollection.countDocuments() > 0) {
        console.log(colorString("R", "There are already data entries in this collection. Clear collection to re-enter data"));
        return;
    }

    console.log(colorString("G", "Getting per-pick and per-round statistic percentages..."));

    const mapPick: Map<string, Stats> = new Map();
    const mapRound: Map<string, Stats> = new Map();

    const minArr = await Promise.all([
        Math.abs((await fieldingCollection.find().toArray()).sort((a, b) => a.uzr - b.uzr)[0]["uzr"]),
        Math.abs((await hittingCollection.find().toArray()).sort((a, b) => a.war - b.war)[0]["war"]),
        Math.abs((await pitchingCollection.find().toArray()).sort((a, b) => a.eraMinus - b.eraMinus)[0]["eraMinus"])
    ]);

    const minimums: {
        uzr: number;
        war: number;
        eraMinus: number;
    } = {
        uzr: minArr[0],
        war: minArr[1],
        eraMinus: minArr[2],
    };

    const players = await playerInfoCollection.find().toArray();

    for (const player of players) {
        const fielding = await fieldingCollection.find({ id: player._id }).toArray();
        const hitting = await hittingCollection.find({ id: player._id }).toArray();
        const pitching = await pitchingCollection.find({ id: player._id }).toArray();

        let round = String(player.draftRound);
        const roundNum = Number(round);
        if (excludedRounds.includes(round) || (!isNaN(roundNum) && roundNum > 20)) {
            continue;
        }

        if (round === "CB-A") {
            round = "1";
        } else if (round === "CB-B") {
            round = "2";
        }

        const newValuePick = mapPick.get(String(player.pickNumber)) ?? createEmptyStats();
        const newValueRound = mapRound.get(round) ?? createEmptyStats();

        for (const obj of fielding) {
            newValuePick.fldPct += Number(obj.fldPct ?? 0);
            newValuePick.uzr += Number(obj.uzr) + Number(minimums.uzr);
            newValuePick.fieldingInnings += calculateNumericInning(Number(obj.innings));
            newValuePick.gamesPlayedFielding += Number(obj.gamesPlayed);

            newValueRound.fldPct += Number(obj.fldPct ?? 0);
            newValueRound.uzr += Number(obj.uzr) + Number(minimums.uzr);
            newValueRound.fieldingInnings += calculateNumericInning(Number(obj.innings));
            newValueRound.gamesPlayedFielding += Number(obj.gamesPlayed);
        }

        for (const obj of hitting) {
            newValuePick.war += Number(obj.war) + Number(minimums.war);
            newValuePick.plateAppearances += Number(obj.plateAppearances);
            newValuePick.gamesPlayedHitting += Number(obj.gamesPlayed);
            newValuePick.ops += Number(obj.ops);

            newValueRound.war += Number(obj.war) + Number(minimums.war);
            newValueRound.plateAppearances += Number(obj.plateAppearances);
            newValueRound.gamesPlayedHitting += Number(obj.gamesPlayed);
            newValueRound.ops += Number(obj.ops);
        }

        for (const obj of pitching) {
            newValuePick.gamesPlayedPitching += Number(obj.gamesPlayed);
            newValuePick.inningsPitched += calculateNumericInning(Number(obj.inningsPitched));
            newValuePick.eraMinus += Number(obj.eraMinus) + Number(minimums.eraMinus);

            newValueRound.gamesPlayedPitching += Number(obj.gamesPlayed);
            newValueRound.inningsPitched += calculateNumericInning(Number(obj.inningsPitched));
            newValueRound.eraMinus += Number(obj.eraMinus) + Number(minimums.eraMinus);
        }

        mapPick.set(String(player.pickNumber), newValuePick);
        mapRound.set(round, newValueRound);
    }

    let [warTotal, uzrTotal, opsTotal, fldPctTotal, eraMinusTotal, inningsPitchedTotal, plateAppearancesTotal, fieldingInningsTotal, gamesPlayedHittingTotal, gamesPlayedPitchingTotal, gamesPlayedFieldingTotal] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

    for (let i = 0; i <= Array.from(mapPick.keys()).filter(t => !isNaN(Number(t))).map(t => Number(t)).sort((a, b) => b - a)[0]; i++) {
        if (!mapPick.get(i.toString())) {
            mapPick.set(i.toString(), createEmptyStats());
        }
    }

    for (const value of mapPick.values()) {
        warTotal += value.war;
        uzrTotal += value.uzr;
        opsTotal += value.ops;
        fldPctTotal += value.fldPct;
        eraMinusTotal += value.eraMinus;
        inningsPitchedTotal += value.inningsPitched;
        plateAppearancesTotal += value.plateAppearances;
        fieldingInningsTotal += value.fieldingInnings;
        gamesPlayedHittingTotal += value.gamesPlayedHitting;
        gamesPlayedPitchingTotal += value.gamesPlayedPitching;
        gamesPlayedFieldingTotal += value.gamesPlayedFielding;
    }

    const perPickTable = [], perRoundTable = [];
    for (const [key, value] of mapPick.entries()) {
        perPickTable.push({
            pick: key,
            war: value.war / warTotal,
            uzr: value.uzr / uzrTotal,
            ops: value.ops / opsTotal,
            fldPct: value.fldPct / fldPctTotal,
            eraMinus: value.eraMinus / eraMinusTotal,
            inningsPitched: value.inningsPitched / inningsPitchedTotal,
            plateAppearances: value.plateAppearances / plateAppearancesTotal,
            fieldingInnings: value.fieldingInnings / fieldingInningsTotal,
            gamesPlayedHitting: value.gamesPlayedHitting / gamesPlayedHittingTotal,
            gamesPlayedPitching: value.gamesPlayedPitching / gamesPlayedPitchingTotal,
            gamesPlayedFielding: value.gamesPlayedFielding / gamesPlayedFieldingTotal,
        });
    }

    for (const [key, value] of mapRound.entries()) {
        perRoundTable.push({
            pick: key,
            war: value.war / warTotal,
            uzr: value.uzr / uzrTotal,
            ops: value.ops / opsTotal,
            fldPct: value.fldPct / fldPctTotal,
            eraMinus: value.eraMinus / eraMinusTotal,
            inningsPitched: value.inningsPitched / inningsPitchedTotal,
            plateAppearances: value.plateAppearances / plateAppearancesTotal,
            fieldingInnings: value.fieldingInnings / fieldingInningsTotal,
            gamesPlayedHitting: value.gamesPlayedHitting / gamesPlayedHittingTotal,
            gamesPlayedPitching: value.gamesPlayedPitching / gamesPlayedPitchingTotal,
            gamesPlayedFielding: value.gamesPlayedFielding / gamesPlayedFieldingTotal,
        });
    }
    await perPickStatisticsPercentageCollection.insertMany(perPickTable);
    await perRoundStatisticsPercentageCollection.insertMany(perRoundTable);
}

async function getPlayerValue() {
    if (await perPickPlayerValuePercentageCollection.countDocuments() > 0 || await perRoundPlayerValuePercentageCollection.countDocuments() > 0) {
        console.log(colorString("R", "There are already data entries in this collection. Clear collection to re-enter data"));
        return;
    }

    console.log(colorString("G", "Getting per-pick player value..."));
    const mapPick = new Map<string, number>();
    const mapRound = new Map<string, number>();

    const mapRoundAvg = {};
    const mapPickAvg = {};
    let totalValue = 0;

    const data = await draftCollection.find({ isPass: false, signingBonus: { $ne: NaN } }).toArray();

    for (const player of data) {
        if (!player) {
            continue;
        }

        const pick = player.pickNumber;
        let round = player.draftRound;
        const roundNum = Number(round);

        if (excludedRounds.includes(round) || (!isNaN(roundNum) && roundNum > 20)) {
            continue;
        }

        if (round === "CB-A") {
            round = "1";
        } else if (round === "CB-B") {
            round = "2";
        }

        const value = Number(player.signingBonus ?? player.pickValue ?? 0);
        totalValue += value;

        if (mapRoundAvg[player.draftRound]) {
            mapRoundAvg[player.draftRound].tot += value;
            mapRoundAvg[player.draftRound].cnt++;
        } else {
            mapRoundAvg[player.draftRound] = {
                tot: value,
                cnt: 1,
            };
        }

        if (mapPickAvg[pick]) {
            mapPickAvg[pick].tot += value;
            mapPickAvg[pick].cnt++;
        } else {
            mapPickAvg[pick] = {
                tot: value,
                cnt: 1,
            };
        }

        if (mapPick.get(pick)) {
            mapPick.set(pick, mapPick.get(pick) + value);
        } else {
            mapPick.set(pick, value);
        }

        if (mapRound.get(round)) {
            mapRound.set(round, mapRound.get(round) + value);
        } else {
            mapRound.set(round, value);
        }
    }

    for (let i = 1; i <= Array.from(await perPickStatisticsPercentageCollection.find().toArray()).filter(t => !isNaN(Number(t.pickNumber))).map(t => Number(t)).sort((a, b) => b - a)[0]; i++) {
        if (!mapPick.get(i.toString())) {
            console.log(`missing: ${i}`)
            mapPick.set(i.toString(), 0);
        }
    }


    const perPickPlayerValueTable = [];
    const perRoundPlayerValueTable = [];
    const perPickPlayerValueAvgTable = [];
    const perRoundPlayerValueAvgTable = [];
    for (const [key, val] of mapPick.entries()) {
        perPickPlayerValueTable.push({ pick: key, pct: val / totalValue });
    }

    for (const [key, val] of mapRound.entries()) {
        perRoundPlayerValueTable.push({ pick: key, pct: val / totalValue });
    }

    for (const key of Object.keys(mapPickAvg)) {
        const tot = mapPickAvg[key].tot;
        const cnt = mapPickAvg[key].cnt;
        perPickPlayerValueAvgTable.push({ pick: key, pct: tot / cnt });
    }

    for (const key of Object.keys(mapRoundAvg)) {
        const tot = mapRoundAvg[key].tot;
        const cnt = mapRoundAvg[key].cnt;
        perRoundPlayerValueAvgTable.push({ pick: key, pct: tot / cnt });
    }

    await perPickPlayerValuePercentageCollection.insertMany(perPickPlayerValueTable);
    await perRoundPlayerValuePercentageCollection.insertMany(perRoundPlayerValueTable);
    await perPickPlayerValueAverageCollection.insertMany(perPickPlayerValueAvgTable);
    await perRoundPlayerValueAverageCollection.insertMany(perRoundPlayerValueAvgTable);
}

async function getDraftInfo(): Promise<void> {
    const draftInfoCount = await draftCollection.countDocuments();
    const draftInfoTable = [];
    if (draftInfoCount > 0) {
        console.log(colorString("R", "There are already data entries in this collection. Clear collection to re-enter data"));
        return;
    }

    console.log(colorString("G", "Getting draft information..."));
    for (let year = startYear - 25; year < endYear; year++) {
        const raw = await fetch(draftPlayers(year));
        const draftinfo = await raw.json();
        for (const round of draftinfo["drafts"]["rounds"]) {
            const picks = round["picks"];
            for (const player of picks) {
                if (player["person"]) {
                    if (player["isPass"] === true) {
                        continue;
                    }
                    console.log(player['signingBonus'])

                    draftInfoTable.push({
                        id: player["person"]["id"] ?? 0,
                        draftYear: year,
                        pickNumber: player["pickNumber"] ?? 0,
                        draftRound: player["pickRound"] ?? 0,
                        isPass: player["isPass"] ?? false,
                        signingBonus: Number(player["signingBonus"]) ?? 0,
                        pickValue: Number(player["pickValue"]) ?? 0,
                    });
                }
            }
        }
    }

    await draftCollection.insertMany(draftInfoTable);
}

async function getPlayerInformation(): Promise<void> {
    const playerInfoCount = await playerInfoCollection.countDocuments();
    const playerInfoTable = [], includedIds = [];

    if (playerInfoCount > 0) {
        console.log(colorString("R", "There are already data entries in this collection. Clear collection to re-enter data."));
        return;
    }

    console.log(colorString("G", "Getting player information from MLB API..."));
    for (let year = startYear; year < endYear; year++) {
        const res = await fetch(yearlyPlayers(year));
        const json = await res.json();

        for (const player of json["people"]) {
            const debut = Number(player["mlbDebutDate"]?.substring(0, 4));
            if (Number.isNaN(debut) || includedIds.includes(player["id"])) {
                continue;
            }

            const playerDraft = await draftCollection.findOne({ id: Number(player["id"]) });
            if (debut >= startYear) {
                includedIds.push(player["id"])
                if (playerDraft) {
                    playerInfoTable.push({
                        _id: player.id,
                        draftYear: player.draftYear ?? 0,
                        draftRound: playerDraft.draftRound,
                        pickNumber: playerDraft.pickNumber,
                        mlbDebutDate: Number((player.mlbDebutDate ?? "00000").substring(0, 4)),
                        lastPlayedDate: Number((player.lastPlayedDate ?? "00000").substring(0, 4) ?? 10000)
                    });
                } else {
                    playerInfoTable.push({
                        _id: player["id"],
                        draftYear: 0,
                        draftRound: "intl",
                        pickNumber: "intl",
                        mlbDebutDate: Number((player["mlbDebutDate"] ?? "00000").substring(0, 4)),
                        lastPlayedDate: Number((player["lastPlayedDate"] ?? "00000").substring(0, 4) ?? 10000)
                    });
                }
            }
        }
    }

    await playerInfoCollection.insertMany(playerInfoTable);
}

async function getPlayerStatistics(): Promise<void> {
    const hittingTable = [],
        pitchingTable = [],
        fieldingTable = [];
    const [fieldingCount, hittingCount, pitchingCount] = await Promise.all([
        fieldingCollection.countDocuments(),
        hittingCollection.countDocuments(),
        pitchingCollection.countDocuments(),
    ]);

    if (fieldingCount !== 0 && pitchingCount !== 0 && hittingCount !== 0) {
        console.log(colorString("R", "There are already data entries in this collection. Clear collection to re-enter data"));
        return;
    }

    console.log(colorString("G", "Getting player statistics..."));
    for (let year = startYear; year < endYear; year++) {
        console.log(year);
        const rows = (await playerInfoCollection.find().toArray()).map(d => Number(d._id));
        const splitArr = splitArray(rows, 640);

        for (const split of splitArr) {
            const raw = await fetch(sabermetricsURL(split, year));
            const json = await raw.json();
            if (!json["people"]) {
                continue;
            }

            for (const player of json["people"]) {
                const stats = player["stats"];
                const statTypes = stats?.map(stat => stat.type.displayName + stat.group.displayName);
                const fielding = stats?.filter(stat => stat.type.displayName === "season" && stat.group.displayName === "fielding");
                let positions;

                if (!stats) {
                    continue;
                }

                if (fielding && fielding.length > 0) {
                    positions = fielding[0].splits.map(split => split.position.abbreviation).filter(onlyUnique);
                }

                const saberhitting = stats.filter(stat => stat.type.displayName === "sabermetrics" && stat.group.displayName === "hitting");
                const seasonhitting = stats.filter(stat => stat.type.displayName === "season" && stat.group.displayName === "hitting");
                const saberfielding = stats.filter(stat => stat.type.displayName === "sabermetrics" && stat.group.displayName === "fielding");
                const seasonfielding = stats.filter(stat => stat.type.displayName === "season" && stat.group.displayName === "fielding");
                const saberpitching = stats.filter(stat => stat.type.displayName === "sabermetrics" && stat.group.displayName === "pitching");
                const seasonpitching = stats.filter(stat => stat.type.displayName === "season" && stat.group.displayName === "pitching");

                if ((statTypes.includes("seasonhitting") || statTypes.includes("sabermetricshitting")) && hittingCount === 0) {
                    hittingTable.push({
                        _id: `${player.id}-${year}`,
                        id: player.id,
                        seasonYear: year,
                        war: saberhitting[0]?.splits[0]?.stat?.war ?? 0,
                        ops: seasonhitting[0]?.splits[0]?.stat?.ops ?? 0,
                        plateAppearances: seasonhitting[0]?.splits[0]?.stat?.plateAppearances ?? 0,
                        gamesPlayed: seasonhitting[0]?.splits[0]?.stat?.gamesPlayed ?? 0
                    });
                }

                if ((statTypes.includes("seasonfielding") || statTypes.includes("sabermetricsfielding")) && positions && fieldingCount === 0) {
                    for (const position of positions) {
                        fieldingTable.push({
                            _id: `${player.id}-${year}-${position}`,
                            id: player.id,
                            seasonYear: year,
                            position: position,
                            uzr: saberfielding[0]?.splits[0]?.stat?.uzr ?? 0,
                            fldPct: seasonfielding[0]?.splits[0]?.stat?.fielding ?? 0,
                            innings: seasonfielding[0]?.splits[0].stat?.innings ?? 0,
                            gamesPlayed: seasonhitting[0]?.splits[0]?.stat?.gamesPlayed ?? 0
                        });
                    }
                }

                if (statTypes.includes("sabermetricspitching") && pitchingCount === 0) {
                    pitchingTable.push({
                        _id: `${player.id}-${year}`,
                        id: player.id,
                        seasonYear: year,
                        eraMinus: saberpitching[0]?.splits[0]?.stat?.eraMinus ?? 0,
                        inningsPitched: seasonpitching[0]?.splits[0].stat?.inningsPitched ?? 0,
                        gamesPlayed: seasonhitting[0]?.splits[0]?.stat?.gamesPlayed ?? 0
                    });
                }
            }
        }
    }

    if (hittingCount === 0 && hittingTable.length > 0) {
        await hittingCollection.insertMany(hittingTable);
        console.log(colorString("G", `Added ${hittingTable.length} entries to Hitting collection.`));
    }
    if (pitchingCount === 0 && pitchingTable.length > 0) {
        await pitchingCollection.insertMany(pitchingTable);
        console.log(colorString("G", `Added ${pitchingTable.length} entries to Pitching collection.`));
    }
    if (fieldingCount === 0 && fieldingTable.length > 0) {
        await fieldingCollection.insertMany(fieldingTable);
        console.log(colorString("G", `Added ${fieldingTable.length} entries to Fielding collection.`));
    }
}
