
import { DraftPlayer, PlayerInformation, RoundEntry, SectionalValue, StatGroup, Timer } from './types';
import { MongoClient, ServerApiVersion } from 'mongodb';
import { connectionUrl } from './credentials';
import readline from 'readline';
import { calculateNumericInning, colorString, draftPlayers, onlyUnique, sabermetricsURL, splitArray, yearlyPlayers } from './util';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function getInput(): Promise<string> {
    return new Promise((resolve) => {
        rl.question('Do you want to clear all collections before data entry?\n', (answer) => {
            resolve(answer.trim().toLowerCase());
        });
    });
}

const client = new MongoClient(connectionUrl, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

const startYear = 2000;
const endYear = 2023;

const mongodb = client.db("MLB");

const playerInfoCollection = mongodb.collection("Player_Info");
const draftColletion = mongodb.collection("Draft_Info");

const fieldingCollection = mongodb.collection("Fielding");
const hittingCollection = mongodb.collection("Hitting");
const pitchingCollection = mongodb.collection("Pitching");

const yearlyTotalsNormalizedCollection = mongodb.collection("Yearly_Totals_Normalized");
const yearlyPercentagesNormalizedCollection = mongodb.collection("Yearly_Percentages_Normalized");
const averageStatNormalizedCollection = mongodb.collection("Average_Stat_Value_Normalized");

const actualPickComboCollection = mongodb.collection("Actual_Pick_Combo");
const actualPickComboPercentageCollection = mongodb.collection("Actual_Pick_Combo_Percentage");

const perPickStatisticsPercentageCollection = mongodb.collection("Per_Pick_Statistics_Percentage");
const perPickPlayerValuePercentageCollection = mongodb.collection("Per_Pick_Player_Value_Percentage");

export async function tryInitializeDatabase() {
    let clearDB;
    while (clearDB === undefined || clearDB === null) {
        const input = await getInput();
        if (!["yes", "no", "y", "n"].includes(input)) {
            console.log('Invalid response.');
            continue;
        }

        clearDB = ["yes", "y"].includes(input) ? true : false;
    }
    rl.close();

    const timer = new Timer();
    await client.connect();
    if (clearDB) {
        (await mongodb.collections()).forEach(c => {
            if (c.dbName === "MLB" && !["Hitting", "Pitching", "Fielding", "Draft_Info", "Player_Info"].includes(c.collectionName)) {
                c.deleteMany();
            }
        });
    }

    await getDraftInfo();
    await getPlayerInformation();
    await getPlayerStatistics();
    await getPerPickStatisticPercentages();
    await getRoundMoneyStuff();
    await getNormalizedYearlyTotals();
    await getNormalizedYearlyPercentages();
    await getPlayerValuePerPick();
    console.log(`======== FINISHED IN ${timer.getElapsedTime(true)} ========`);
}

async function getPerPickStatisticPercentages() {
    if (await perPickStatisticsPercentageCollection.countDocuments() > 0) {
        console.log(colorString("R", "There are already data entries in this collection. Clear the collections to re-enter data."));
        return;
    }

    console.log(colorString("G", "Getting per-pick statistic percentages..."));
    let map: Map<string, {
        war: number,
        uzr: number,
        ops: number,
        fldPct: number,
        eraMinus: number,
        inningsPitched: number,
        plateAppearances: number,
        fieldingInnings: number,
        gamesPlayedHitting: number,
        gamesPlayedPitching: number,
        gamesPlayedFielding: number
    }> = new Map();

    const perPickTable = [];

    const minArr = await Promise.all([
        Math.abs((await fieldingCollection.find().toArray()).sort((a, b) => a.uzr - b.uzr)[0]['uzr']),
        Math.abs((await hittingCollection.find().toArray()).sort((a, b) => a.war - b.war)[0]['war']),
        Math.abs((await pitchingCollection.find().toArray()).sort((a, b) => a.eraMinus - b.eraMinus)[0]['eraMinus'])
    ]);
    const minimums: { uzr: number, war: number, eraMinus: number } = {
        uzr: minArr[0],
        war: minArr[1],
        eraMinus: minArr[2],
    }

    const hittingData = await hittingCollection.find().toArray();
    const pitchingData = await pitchingCollection.find().toArray();
    const fieldingData = await fieldingCollection.find().toArray();

    for (let i = startYear; i < endYear; i++) {
        const yearlyDraft = await draftColletion.find({ draftYear: i }).toArray();

        for (let player of yearlyDraft) {
            const pick = `${player.draftRound}-${player.draftPosition}`;
            const playerHitting = hittingData.find((h) => h.id === player.id) || { war: 0, ops: 0, plateAppearances: 0, gamesPlayed: 0 };
            const playerPitching = pitchingData.find((p) => p.id === player.id) || { eraMinus: 0, inningsPitched: 0, gamesPlayed: 0 };
            const playerFielding = fieldingData.find((f) => f.id === player.id) || { fldPct: 0, uzr: 0, innings: 0, gamesPlayed: 0 };

            const stats = {
                eraMinus: Number(playerPitching.eraMinus) + Number(minimums.eraMinus),
                war: Number(playerHitting.war) + Number(minimums.war),
                uzr: Number(playerFielding.uzr) + Number(minimums.uzr),
                plateAppearances: Number(playerHitting.plateAppearances),
                gamesPlayedFielding: Number(playerFielding.gamesPlayed),
                gamesPlayedPitching: Number(playerPitching.gamesPlayed),
                gamesPlayedHitting: Number(playerHitting.gamesPlayed),
                inningsPitched: Number(playerPitching.inningsPitched),
                fieldingInnings: Number(playerFielding.innings),
                fldPct: Number(playerFielding.fldPct),
                ops: Number(playerHitting.ops),
            }

            if (map.has(pick)) {
                let mapValue = map.get(pick);
                for (var obj of Object.keys(mapValue)) {
                    mapValue[obj] += Number(stats[obj] ?? 0) + Number(minimums[obj] ?? 0);
                }
                map.set(pick, mapValue);
            } else {
                map.set(pick, stats);
            }
        }
    }

    let [warTotal, uzrTotal, opsTotal, fldPctTotal, eraMinusTotal, inningsPitchedTotal, plateAppearancesTotal, fieldingInningsTotal, gamesPlayedHittingTotal, gamesPlayedPitchingTotal, gamesPlayedFieldingTotal] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

    for (const value of map.values()) {
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


    for (const [key, value] of map.entries()) {
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
    await perPickStatisticsPercentageCollection.insertMany(perPickTable);
}

async function getNormalizedYearlyPercentages(): Promise<void> {
    const yearlyPercentagesNormalizedCount = await yearlyPercentagesNormalizedCollection.countDocuments();
    if (yearlyPercentagesNormalizedCount > 0) {
        console.log(colorString("R", "There are already data entries in this collection. Clear collection to re-enter data"));
        return;
    }

    console.log(colorString("G", "Getting normalized yearly percentages..."));
    let map: Map<string, {
        war: StatGroup,
        uzr: StatGroup,
        ops: StatGroup,
        fldPct: StatGroup,
        eraMinus: StatGroup,
        inningsPitched: StatGroup,
        plateAppearances: StatGroup,
        fieldingInnings: StatGroup,
        gamesPlayedHitting: StatGroup,
        gamesPlayedPitching: StatGroup,
        gamesPlayedFielding: StatGroup
    }> = new Map();

    let [warTotal, uzrTotal, opsTotal, fldPctTotal, eraMinusTotal, inningsPitchedTotal, plateAppearancesTotal, fieldingInningsTotal, gamesPlayedHittingTotal, gamesPlayedFieldingTotal, gamesPlayedPitchingTotal] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

    for (let i = startYear; i < endYear; i++) {
        const yearlyTotals = (await yearlyTotalsNormalizedCollection.find({ year: i }).toArray())[0];
        for (let entry of Object.entries(yearlyTotals)) {
            if (["_id", "year"].includes(entry[0])) {
                continue;
            }

            warTotal += Number(entry[1]['war']['sum']);
            uzrTotal += Number(entry[1]['uzr']['sum']);
            opsTotal += Number(entry[1]['ops']['sum']);
            fldPctTotal += Number(entry[1]['fldPct']['sum']);
            eraMinusTotal += Number(entry[1]['eraMinus']['sum']);
            inningsPitchedTotal += Number(entry[1]['inningsPitched']['sum']);
            plateAppearancesTotal += Number(entry[1]['plateAppearances']['sum']);
            fieldingInningsTotal += Number(entry[1]['fieldingInnings']['sum']);
            gamesPlayedFieldingTotal += Number(entry[1]['gamesPlayedFielding']['sum']);
            gamesPlayedPitchingTotal += Number(entry[1]['gamesPlayedPitching']['sum']);
            gamesPlayedHittingTotal += Number(entry[1]['gamesPlayedHitting']['sum']);

            if (map.has(entry[0])) {
                const prev = map.get(entry[0]);
                map.set(entry[0], {
                    war: {
                        sum: prev.war.sum + entry[1]['war']['sum'],
                        plr_count: prev.war.plr_count + entry[1]['war']['plr_count'],
                    },
                    uzr: {
                        sum: prev.uzr.sum + entry[1]['uzr']['sum'],
                        plr_count: prev.uzr.plr_count + entry[1]['uzr']['plr_count'],
                    },
                    ops: {
                        sum: prev.ops.sum + entry[1]['ops']['sum'],
                        plr_count: prev.ops.plr_count + entry[1]['ops']['plr_count'],
                    },
                    fldPct: {
                        sum: prev.fldPct.sum + entry[1]['fldPct']['sum'],
                        plr_count: prev.fldPct.plr_count + entry[1]['fldPct']['plr_count'],
                    },
                    eraMinus: {
                        sum: prev.eraMinus.sum + entry[1]['eraMinus']['sum'],
                        plr_count: prev.eraMinus.plr_count + entry[1]['eraMinus']['plr_count'],
                    },
                    inningsPitched: {
                        sum: prev.inningsPitched.sum + entry[1]['inningsPitched']['sum'],
                        plr_count: prev.inningsPitched.plr_count + entry[1]['inningsPitched']['plr_count'],
                    },
                    plateAppearances: {
                        sum: prev.plateAppearances.sum + entry[1]['plateAppearances']['sum'],
                        plr_count: prev.plateAppearances.plr_count + entry[1]['plateAppearances']['plr_count'],
                    },
                    fieldingInnings: {
                        sum: prev.fieldingInnings.sum + entry[1]['fieldingInnings']['sum'],
                        plr_count: prev.fieldingInnings.plr_count + entry[1]['fieldingInnings']['plr_count'],
                    },
                    gamesPlayedHitting: {
                        sum: prev.gamesPlayedHitting.sum + entry[1]['gamesPlayedHitting']['sum'],
                        plr_count: prev.gamesPlayedHitting.plr_count + entry[1]['gamesPlayedHitting']['plr_count'],
                    },
                    gamesPlayedPitching: {
                        sum: prev.gamesPlayedPitching.sum + entry[1]['gamesPlayedPitching']['sum'],
                        plr_count: prev.gamesPlayedPitching.plr_count + entry[1]['gamesPlayedPitching']['plr_count'],
                    },
                    gamesPlayedFielding: {
                        sum: prev.gamesPlayedFielding.sum + entry[1]['gamesPlayedFielding']['sum'],
                        plr_count: prev.gamesPlayedFielding.plr_count + entry[1]['gamesPlayedFielding']['plr_count'],
                    }
                });
            } else {
                map.set(entry[0], entry[1]);
            }
        }
    }

    let averageStatForRound: RoundEntry[] = [];
    let percentByRoundTable: RoundEntry[] = [];
    for (let [key, value] of map.entries()) {
        let round: RoundEntry = {
            round: key,
            stats: {
                war: value.war.sum / warTotal,
                uzr: value.uzr.sum / uzrTotal,
                ops: value.ops.sum / opsTotal,
                fldPct: value.fldPct.sum / fldPctTotal,
                eraMinus: value.eraMinus.sum / eraMinusTotal,
                inningsPitched: value.inningsPitched.sum / inningsPitchedTotal,
                plateAppearances: value.plateAppearances.sum / plateAppearancesTotal,
                fieldingInnings: value.fieldingInnings.sum / fieldingInningsTotal,
                gamesPlayedHitting: value.gamesPlayedHitting.sum / gamesPlayedHittingTotal,
                gamesPlayedPitching: value.gamesPlayedPitching.sum / gamesPlayedPitchingTotal,
                gamesPlayedFielding: value.gamesPlayedFielding.sum / gamesPlayedFieldingTotal
            }
        }

        let statRound: RoundEntry = {
            round: key,
            stats: {
                war: value.war.sum / value.war.plr_count,
                uzr: value.uzr.sum / value.uzr.plr_count,
                ops: value.ops.sum / value.ops.plr_count,
                fldPct: value.fldPct.sum / value.fldPct.plr_count,
                eraMinus: value.eraMinus.sum / value.eraMinus.plr_count,
                inningsPitched: value.inningsPitched.sum / value.inningsPitched.plr_count,
                plateAppearances: value.plateAppearances.sum / value.plateAppearances.plr_count,
                fieldingInnings: value.fieldingInnings.sum / value.fieldingInnings.plr_count,
                gamesPlayedHitting: value.gamesPlayedHitting.sum / value.gamesPlayedHitting.plr_count,
                gamesPlayedPitching: value.gamesPlayedPitching.sum / value.gamesPlayedPitching.plr_count,
                gamesPlayedFielding: value.gamesPlayedFielding.sum / value.gamesPlayedFielding.plr_count
            }
        }

        percentByRoundTable.push(round);
        averageStatForRound.push(statRound);
    }

    await averageStatNormalizedCollection.insertMany(averageStatForRound);
    await yearlyPercentagesNormalizedCollection.insertMany(percentByRoundTable);
}

async function getNormalizedYearlyTotals(): Promise<void> {
    const normalizedYearlyTotalsCount = await yearlyTotalsNormalizedCollection.countDocuments();
    if (normalizedYearlyTotalsCount > 0) {
        console.log(colorString("R", "There are already data entries in this collection. Clear collection to re-enter data"));
        return;
    }

    console.log(colorString("G", "Getting normalized yearly totals..."));
    let result: any[] = [];
    const [uzrMin, warMin, eraMinusMin]: number[] = await Promise.all([
        Math.abs((await fieldingCollection.find().toArray()).sort((a, b) => a.uzr - b.uzr)[0]['uzr']),
        Math.abs((await hittingCollection.find().toArray()).sort((a, b) => a.war - b.war)[0]['war']),
        Math.abs((await pitchingCollection.find().toArray()).sort((a, b) => a.eraMinus - b.eraMinus)[0]['eraMinus'])
    ]);

    for (let i = startYear; i < endYear; i++) {
        const draftInfo = await draftColletion.find().toArray();
        let yearly = {
            year: i
        };

        const [yearlyFielding, yearlyPitching, yearlyHitting] = await Promise.all([
            fieldingCollection.find({ seasonYear: i }).toArray(),
            pitchingCollection.find({ seasonYear: i }).toArray(),
            hittingCollection.find({ seasonYear: i }).toArray(),
        ]);

        for (var doc of yearlyFielding) {
            const draftPlayer = draftInfo.find(draft => draft.id === doc.id);
            const key = draftPlayer?.draftRound || "intl";
            const fieldingInnings = calculateNumericInning(doc.innings ?? 0);

            yearly[key] = yearly[key] ?? new SectionalValue();
            yearly[key].fldPct.plr_count++;
            yearly[key].fldPct.sum += Number(doc.fldPct ?? 0);
            yearly[key].uzr.plr_count++;
            yearly[key].uzr.sum += Number(doc.uzr ?? 0) + (uzrMin ?? 0);
            yearly[key].fieldingInnings.plr_count++;
            yearly[key].fieldingInnings.sum += Number(fieldingInnings);
            yearly[key].gamesPlayedFielding.plr_count++;
            yearly[key].gamesPlayedFielding.sum += Number(doc.gamesPlayed);
        }

        for (var doc of yearlyHitting) {
            const draftPlayer = draftInfo.find(draft => draft.id === doc.id);
            const key = draftPlayer?.draftRound || "intl";

            yearly[key] = yearly[key] ?? new SectionalValue();
            yearly[key].ops.plr_count++;
            yearly[key].ops.sum += Number(doc.ops ?? 0);
            yearly[key].war.plr_count++;
            yearly[key].war.sum += Number(doc.war ?? 0) + (warMin ?? 0);
            yearly[key].plateAppearances.plr_count++;
            yearly[key].plateAppearances.sum += Number(doc.plateAppearances ?? 0);
            yearly[key].gamesPlayedHitting.plr_count++;
            yearly[key].gamesPlayedHitting.sum += Number(doc.gamesPlayed);
        }

        for (var doc of yearlyPitching) {
            const draftPlayer = draftInfo.find(draft => draft.id === doc.id);
            const key = draftPlayer?.draftRound || "intl";
            const inningsPitched = calculateNumericInning(doc.inningsPitched ?? 0);

            yearly[key] = yearly[key] ?? new SectionalValue();
            yearly[key].eraMinus.plr_count++;
            yearly[key].eraMinus.sum += Number(doc.eraMinus ?? 0) + (eraMinusMin ?? 0);
            yearly[key].inningsPitched.plr_count++;
            yearly[key].inningsPitched.sum += Number(inningsPitched);
            yearly[key].gamesPlayedPitching.plr_count++;
            yearly[key].gamesPlayedPitching.sum += Number(doc.gamesPlayed);
        }
        result.push(yearly);
    }

    await yearlyTotalsNormalizedCollection.insertMany(result);
}

async function getPlayerValuePerPick() {
    if (await perPickPlayerValuePercentageCollection.countDocuments() > 0) {
        console.log(colorString("R", "There are already data entries in this collection. Clear collection to re-enter data"));
        return;
    }

    console.log(colorString("G", "Getting per-pick player value..."));
    let map = new Map<string, number>();
    let totalValue = 0;
    const data = await draftColletion.find({ draftYear: { "$gte": startYear }, isPass: false }).toArray();

    for (var player of data) {
        const pick = `${player.draftRound}-${player.draftPosition}`;
        const signingBonusNum = Number(player["signingBonus"] ?? 0);
        const pickValueNum = Number(player["pickValue"] ?? 0);

        let valueArray: number[] = [];
        if (!isNaN(signingBonusNum)) {
            valueArray.push(signingBonusNum);
        }
        if (!isNaN(pickValueNum)) {
            valueArray.push(pickValueNum);
        }

        let value = Math.max(...valueArray);
        totalValue += value;
        if (map.get(pick)) {
            map.set(pick, map.get(pick) + value)
        } else {
            map.set(pick, value)
        }
    }

    let perPickPlayerValueTable = [];
    for (var [key, val] of map.entries()) {
        perPickPlayerValueTable.push({ pick: key, pct: val / totalValue });
    }

    await perPickPlayerValuePercentageCollection.insertMany(perPickPlayerValueTable);

}

async function getRoundMoneyStuff(): Promise<void> {
    const actualPickComboCount = await actualPickComboCollection.countDocuments();
    const actualPickComboPercentageCount = await actualPickComboPercentageCollection.countDocuments();

    if (actualPickComboCount > 0 || actualPickComboPercentageCount > 0) {
        console.log(colorString("R", "There are already data entries in this collection. Clear collection to re-enter data"));
        return;
    }

    const data = await draftColletion.find({ draftYear: { "$gte": startYear }, isPass: false }).toArray();
    let actualPickComboValue = {};
    let actualPickValueSum = 0, actualPickValueCount = 0;

    console.log(colorString("G", "Getting player values..."));
    for (var player of data) {
        let draftRound = player['draftRound'] ?? "intl";

        if (!actualPickComboValue[draftRound]) {
            actualPickComboValue[draftRound] = SectionalValue.newStatGroup();
        }

        let signingBonusNum = Number(player["signingBonus"]);
        let pickValueNum = Number(player["pickValue"]);

        if (pickValueNum || signingBonusNum) {
            actualPickComboValue[draftRound]["sum"] += Math.max(pickValueNum ?? 0, signingBonusNum ?? 0);
            actualPickValueSum += Math.max(pickValueNum ?? 0, signingBonusNum ?? 0);
            actualPickValueCount++;
        }

        actualPickComboValue[draftRound]["plr_count"]++;
    }

    let actualPickComboArray = [];
    let actualPickComboPct = [];

    for (var round of Object.keys(actualPickComboValue)) {
        actualPickComboArray.push({
            round: round,
            totalValue: actualPickComboValue[round]["sum"],
            playerCount: actualPickComboValue[round]["plr_count"]
        });

        actualPickComboPct.push({
            round: round,
            totalValue: actualPickComboValue[round]["sum"] / actualPickValueSum,
            playerCount: actualPickValueCount
        });
    }

    await actualPickComboCollection.insertMany(actualPickComboArray)
    await actualPickComboPercentageCollection.insertMany(actualPickComboPct)
}

async function getDraftInfo(): Promise<void> {
    const draftInfoCount = await draftColletion.countDocuments();
    let draftInfoTable = [];
    if (draftInfoCount > 0) {
        console.log(colorString("R", "There are already data entries in this collection. Clear collection to re-enter data"));
        return;
    }

    console.log(colorString("G", "Getting draft information..."));
    for (let year = startYear; year < endYear; year++) {
        let raw = await fetch(draftPlayers(year));
        let draftinfo = await raw.json();
        for (var round of draftinfo['drafts']['rounds']) {
            let picks = round["picks"];
            for (var player of picks) {
                if (player['person']) {
                    let school: "UNI" | "HS" | "N/A";
                    const schoolName = player['school']['name'];
                    const schoolClass = player['school']['schoolClass'];

                    if (schoolClass) {
                        school = schoolClass.substring(0, 2) === "HS" ? "HS" : "UNI";
                    } else if (schoolName) {
                        if (schoolName.split(" ").includes("HS")) {
                            school = "HS";
                        } else {
                            school = "UNI";
                        }
                    } else {
                        school = "N/A";
                    }

                    let info: DraftPlayer = {
                        id: player['person']['id'] ?? 0,
                        draftYear: year,
                        draftRound: player['pickRound'] ?? 0,
                        draftPosition: player['roundPickNumber'] ?? 0,
                        isPass: player['isPass'] ?? false,
                        signingBonus: player['signingBonus'] ?? 0,
                        pickValue: player['pickValue'] ?? 0,
                        school: school
                    }
                    draftInfoTable.push(info);
                }
            }
        }
    }

    await draftColletion.insertMany(draftInfoTable);
}

async function getPlayerInformation(): Promise<void> {
    const playerInfoCount = await playerInfoCollection.countDocuments();
    let playerInfoTable = [], includedIds = [];

    if (playerInfoCount > 0) {
        console.log(colorString("R", "There are already data entries in this collection. Clear collection to re-enter data."));
        return;
    }

    console.log(colorString("G", "Getting player information from MLB API..."));
    for (let year = startYear; year < endYear; year++) {
        let res = await fetch(yearlyPlayers(year));
        let json = await res.json();

        for (var player of json['people']) {
            if (Number.isNaN(Number(player['mlbDebutDate']?.substring(0, 4))) || includedIds.includes(player['id'])) {
                continue;
            }

            includedIds.push(player['id'])
            playerInfoTable.push({
                _id: player['id'],
                firstName: player['firstName'],
                lastName: player['lastName'],
                birthDate: player['birthDate'],
                birthCountry: player['birthCountry'],
                height: player['height'],
                weight: player['weight'],
                draftYear: player['draftYear'] ?? 0,
                mlbDebutDate: Number(player['mlbDebutDate']?.substring(0, 4)),
                lastPlayedDate: Number(player['lastPlayedDate']?.substring(0, 4) ?? 10000),
                batSide: player['batSide']['code'],
                pitchHand: player['pitchHand']['code']
            } as PlayerInformation);
        }
    }

    await playerInfoCollection.insertMany(playerInfoTable);
    console.log(`Finished adding ${playerInfoTable.length} players into PLAYER_INFO table.`);
}

async function getPlayerStatistics(): Promise<void> {
    let hittingTable = [], pitchingTable = [], fieldingTable = [];
    const [fieldingCount, hittingCount, pitchingCount] = await Promise.all([
        fieldingCollection.countDocuments(),
        hittingCollection.countDocuments(),
        pitchingCollection.countDocuments()
    ]);

    if (fieldingCount != 0 && pitchingCount != 0 && hittingCount != 0) {
        console.log(colorString("R", "There are already data entries in this collection. Clear collection to re-enter data"));
        return;
    }

    console.log(colorString("G", "Getting player statistics..."));
    for (let year = startYear; year < endYear; year++) {
        const rows = await playerInfoCollection.find({
            "mlbDebutDate": {
                $gte: year
            }
        }).toArray();

        const filtered = rows.map(doc => Number(doc._id));
        const splitArr = splitArray(filtered, 640);

        for (let split of splitArr) {
            const json = await (await fetch(sabermetricsURL(split, year))).json();
            if (!json['people']) {
                continue;
            }

            for (let player of json['people']) {
                const stats = player['stats'];
                const statTypes = stats?.map(stat => stat.type.displayName + stat.group.displayName);
                let fielding = stats?.filter(stat => stat.type.displayName == "season" && stat.group.displayName == "fielding"), positions;

                if (!stats || !fielding) {
                    continue;
                }

                if (fielding.length > 0) {
                    positions = fielding[0].splits.map(split => split.position.abbreviation).filter(onlyUnique);
                }

                const saberhitting = stats.filter(stat => stat.type.displayName == "sabermetrics" && stat.group.displayName == "hitting");
                const seasonhitting = stats.filter(stat => stat.type.displayName == "season" && stat.group.displayName == "hitting");
                const saberfielding = stats.filter(stat => stat.type.displayName == "sabermetrics" && stat.group.displayName == "fielding");
                const seasonfielding = stats.filter(stat => stat.type.displayName == "season" && stat.group.displayName == "fielding");
                const saberpitching = stats.filter(stat => stat.type.displayName == "sabermetrics" && stat.group.displayName == "pitching");
                const seasonpitching = stats.filter(stat => stat.type.displayName == "season" && stat.group.displayName == "pitching");

                if ((statTypes.includes("seasonhitting") || statTypes.includes("sabermetricshitting")) && hittingCount == 0) {
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

                if ((statTypes.includes("seasonfielding") || statTypes.includes("sabermetricsfielding")) && positions && fieldingCount == 0) {
                    for (var position of positions) {
                        fieldingTable.push({
                            _id: `${player.id}-${year}-${position}`,
                            id: player.id,
                            seasonYear: year,
                            position: position,
                            uzr: saberfielding[0]?.splits[0]?.stat?.uzr ?? 0,
                            fldPct: seasonfielding[0]?.splits[0]?.stat?.fielding ?? 0,
                            innings: seasonfielding[0]?.splits[0].stat?.innings ?? 0,
                            gamesPlayed: seasonhitting[0]?.splits[0]?.stat?.gamesPlayed ?? 0
                        })
                    }
                }

                if (statTypes.includes("sabermetricspitching") && pitchingCount == 0) {
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

    if (hittingCount == 0 && hittingTable.length > 0) {
        await hittingCollection.insertMany(hittingTable);
        console.log(colorString("G", `Added ${hittingTable.length} entries to Hitting collection.`));
    }
    if (pitchingCount == 0 && pitchingTable.length > 0) {
        await pitchingCollection.insertMany(pitchingTable);
        console.log(colorString("G", `Added ${pitchingTable.length} entries to Pitching collection.`));
    }
    if (fieldingCount == 0 && fieldingTable.length > 0) {
        await fieldingCollection.insertMany(fieldingTable);
        console.log(colorString("G", `Added ${fieldingTable.length} entries to Fielding collection.`));
    }
}
