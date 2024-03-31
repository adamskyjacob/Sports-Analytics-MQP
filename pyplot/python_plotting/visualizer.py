
from numpy._typing import _256Bit
from pymongo import MongoClient
from pymongo import server_api
from pymongo.collection import Collection
from pymongo.database import Database

from scipy.optimize import curve_fit

import numpy as np
import matplotlib.pyplot as plt

from credentials import connectionUrl


def sort(item) -> int:
    try:
        val = int(item["pick"])
        return val
    except ValueError:
        if item["pick"] == "intl":
            return 3100
    return 3000


def sort_avg(item) -> int:
    try:
        val = int(item["pick"])
        if val > 2:
            return val + 2
        elif val == 2:
            return 3
        else:
            return 1
    except ValueError:
        if item["pick"] == "CB-A":
            return 2
        elif item["pick"] == "CB-B":
            return 4
        else:
            return 3000


class Visualizer:
    # setting up connection to database and defining collections
    def __init__(self, img_dir: str) -> None:
        self.stat_dir_parser = {
            "war": "hitting",
            "ops": "hitting",
            "plateAppearances": "hitting",
            "gamesPlayedHitting": "hitting",
            "uzr": "fielding",
            "fldPct": "fielding",
            "fieldingInnings": "fielding",
            "gamesPlayedFielding": "fielding",
            "eraMinus": "pitching",
            "inningsPitched": "pitching",
            "gamesPlayedPitching": "pitching",
        }

        self.__client: MongoClient = MongoClient(
            connectionUrl, server_api=server_api.ServerApi("1")
        )
        self.__mongodb: Database = self.__client["MLB"]
        self.__img_dir: str = img_dir

        # there are more collections than this in the db (i.e. Hitting, Pitching, Fielding),
        # but only need these four for the analysis
        self.per_pick_stat_pct: Collection = self.__mongodb[
            "Per_Pick_Statistics_Percentage"
        ]
        self.per_pick_player_value_pct: Collection = self.__mongodb[
            "Per_Pick_Player_Value_Percentage"
        ]
        self.per_round_stat_pct: Collection = self.__mongodb[
            "Per_Round_Statistics_Percentage"
        ]
        self.per_round_player_value_pct: Collection = self.__mongodb[
            "Per_Round_Player_Value_Percentage"
        ]

        self.per_round_player_value_avg: Collection = self.__mongodb[
            "Per_Round_Player_Value_Average"
        ]
        self.per_pick_player_value_avg: Collection = self.__mongodb[
            "Per_Pick_Player_Value_Average"
        ]
        
        self.per_pick_stat_avg: Collection = self.__mongodb[
             "Per_Pick_Statistics_Average"
        ]
        self.per_round_stat_avg: Collection = self.__mongodb[
             "Per_Round_Statistics_Average"
        ]


        self.y_label: str = "Percentage (%)"
        self.x_label_p: str = "Draft Pick Number"
        self.x_label_r: str = "Draft Round"

        self.title_map: dict(str, str) = {
            "war": "Wins Above Replacement (WAR)",
            "uzr": "Ultimate Zone Rating (UZR)",
            "ops": "On-Base Plus Slugging (OPS)",
            "eraMinus": "Earned Run Average Minus (ERA-)",
            "fldPct": "Fielding Percentage (FLD)",
            "inningsPitched": "Innings Pitched (IP)",
            "plateAppearances": "Plate Appearances (PA)",
            "fieldingInnings": "Fielding Innings (INN)",
            "gamesPlayedHitting": "Games Played (GPH)",
            "gamesPlayedFielding": "Games Played (GPF)",
            "gamesPlayedPitching": "Games Played (GPP)",
        }

        self.abbrev_map: dict(str, str) = {
            "war": "WAR",
            "uzr": "UZR",
            "ops": "OPS",
            "eraMinus": "ERA-",
            "fldPct": "FLD",
            "inningsPitched": "IP",
            "plateAppearances": "PA",
            "fieldingInnings": "INN",
            "gamesPlayedHitting": "GPH",
            "gamesPlayedFielding": "GPF",
            "gamesPlayedPitching": "GPP",
        }

        self.label_size: int = 75
        self.title_size: int = 85
        self.tick_size: int = 60
        self.delta_size: int = 65
        self.intl_solo_size: int = 1500
        self.line_size: int = 12

    def plot_monetary_avg(self) -> None:
        self.init_plot()

        pick_avg = sorted(list(self.per_pick_player_value_avg.find()), key=sort_avg)
        round_avg = sorted(list(self.per_round_player_value_avg.find()), key=sort_avg)

        plt.xticks(fontsize=self.tick_size)
        plt.yticks(fontsize=self.tick_size)
        plt.title("Per-Pick Average PV", fontsize=self.title_size)
        plt.xlabel(self.x_label_p, fontsize=self.label_size)
        plt.ylabel("Average Draft Value (Millions)", fontsize=self.label_size)
        plt.bar(range(0, len(pick_avg)), [d["pct"] for d in pick_avg])

        plt.tight_layout()
        plt.savefig(f"{self.__img_dir}pv_avg/pick.png")

        self.clear()
        plt.close()

        self.init_plot()

        plt.xticks(fontsize=self.tick_size)
        plt.yticks(fontsize=self.tick_size)
        plt.title("Per-Round Average PV", fontsize=self.title_size)
        plt.xticks(range(0, len(round_avg)), [d["pick"] for d in round_avg])
        plt.xlabel(self.x_label_r, fontsize=self.label_size)
        plt.ylabel("Average Draft Value (Millions)", fontsize=self.label_size)
        plt.bar(range(0, len(round_avg)), [d["pct"] for d in round_avg])

        plt.tight_layout()
        plt.savefig(f"{self.__img_dir}pv_avg/round.png")

        self.clear()
        plt.close()

    def plot_monetary(self, isround: bool) -> None:
        def inverse_exponential(x, a, b, c):
            return a * np.exp(-b * x) + c

        self.init_plot()

        monetary = sorted(
            list(
                self.per_round_player_value_pct.find()
                if isround
                else self.per_pick_player_value_pct.find()
            ),
            key=sort,
        )
        x_mon = range(0, len(monetary))
        y_mon = [d["pct"] * 100 for d in monetary]

        popt, _ = curve_fit(inverse_exponential, x_mon, y_mon)
        a_opt, b_opt, c_opt = popt
        x_fit = np.linspace(0, max(x_mon), len(x_mon))
        y_fit = inverse_exponential(x_fit, a_opt, b_opt, c_opt)

        plt.scatter(x_mon, y_mon, label="Actual Draft Value", color="red", s=self.intl_solo_size)
        plt.plot(x_fit, y_fit, label="Draft Value Best Fit", color="blue", linewidth=self.line_size)

        plt.xticks(fontsize=self.tick_size)
        plt.yticks(fontsize=self.tick_size)
        plt.title(f"Per-{'Round' if isround else 'Pick'} Draft Value", fontsize=self.title_size)
        
        if isround:
            plt.xticks(range(0, len(monetary)), range(1, len(monetary) + 1))
        
        plt.xlabel(self.x_label_r if isround else self.x_label_p, fontsize=self.label_size)
        plt.ylabel(self.y_label, fontsize=self.label_size)
        
        plt.legend(fontsize=self.tick_size)
        plt.tight_layout()
        plt.savefig(f"{self.__img_dir}pickvalue/{'round' if isround else 'pick'}.png")
        self.clear()
        plt.close()

    def plot_stat(
        self,
        y_data: list[int],
        title: str,
        filename: str,
        isround: bool,
        keys: list[str],
        delta: bool,
        avg: bool,
    ) -> None:
        def inverse_exponential(x, a, b, c):
            return a * np.exp(-b * x) + c

        self.init_plot()

        # preprocessing of player value data (convert decimal to pct), just sorting based on round and putting "intl" at the end.
        monetary = sorted(
            list(
                self.per_round_player_value_pct.find()
                if isround
                else self.per_pick_player_value_pct.find()
            ),
            key=sort,
        )
        x_data = range(0, len(y_data))
        x_mon = range(0, len(monetary))
        y_mon = [d["pct"] if avg else d["pct"] * 100 for d in monetary]

        # subarray of x_data is excluding international from the best fit curve calculation
        # dont want it included because it would heavily skew the curve upwards towards the
        # end, and the curve is only for comparison between player value and stat pct.
        popt, _ = curve_fit(inverse_exponential, x_data[:-1], y_data[:-1], maxfev=5000)
        a_opt, b_opt, c_opt = popt
        x_fit = np.linspace(0, max(x_data[:-1]), len(x_data[:-1]) if isround else 650)
        y_fit = inverse_exponential(x_fit, a_opt, b_opt, c_opt)

        if not avg:
            plt.plot(x_fit, y_fit, "r-", label=self.abbrev_map[title], linewidth=self.line_size)
            plt.bar(x_mon, y_mon, label="Draft Value Percentage")
        
        plt.xlabel(self.x_label_r if isround else self.x_label_p, fontsize=self.label_size)    
        plt.ylabel(self.y_label if not avg else "Average Value", fontsize=self.label_size)
        plt.title(self.title_map[title], fontsize=self.title_size)

        plt.yticks(fontsize=self.tick_size)

        # conditional formatting because round data has higher pct total, also only want the delta line for round data
        # because there are too many bars for pick data
        if isround and not avg:
            plt.ylim(0, 60)
            plt.xticks(range(len(keys)), keys, fontsize=self.tick_size)

            if delta == True:
                zipped = list(zip(y_mon, y_fit))
                plt.bar(
                    x_fit,
                    height=[d[0] - d[1] for d in zipped],
                    bottom=y_fit,
                    color="black",
                    alpha=1,
                    label="PV Stat Delta",
                    width=0.075,
                )

            # optional plotting of actual stat values, excluded to simplify graph
            # plt.scatter(x_data, y_data, label=f"Actual {title}")

            plt.scatter([x_data[-1]], [y_data[-1]], label="Undrafted Stat %", s=[self.intl_solo_size])
        elif avg:
            if isround:
                plt.xticks(range(len(keys)), keys, fontsize=self.tick_size)
            plt.bar(x_data, y_data);
        else:
            plt.ylim(0, 5)
            plt.xticks(fontsize=self.tick_size)
            plt.scatter(x_data, y_data, label=f"Actual {title}", s=self.intl_solo_size)

        # adding pct delta values to graph
        if delta == True:
            for i in range(len(x_data) - 1):
                x_mid = (x_data[i] + x_mon[i]) / 2
                difference = y_mon[i] - y_data[i]
                plt.text(
                    x_mid,
                    max(y_data[i], y_mon[i]) + 1,
                    f"{difference:.2f}%",
                    ha="center",
                    va="bottom",
                    fontsize=self.delta_size,
                    rotation=90
                )

        plt.legend(fontsize=self.tick_size)
        plt.tight_layout()
        plt.savefig(
            f"{self.__img_dir}{'delta' if delta else 'normal'}/{'round' if isround else 'pick'}/{'avg' if avg else 'total_pct'}/{self.stat_dir_parser.get(filename)}/{'round' if isround else 'pick'}_{filename}{'_pvdelta' if delta else ('_avg' if avg else '')}.png"
        )
        self.clear()
        plt.close()

    # clears everything from the plot
    def clear(self) -> None:
        plt.cla()
        plt.clf()

    # Initialize plot dimensions and axes
    def init_plot(self) -> None:
        plt.figure(figsize=(64, 28))

        plt.gca().spines["top"].set_linewidth(10)
        plt.gca().spines["right"].set_linewidth(10)
        plt.gca().spines["bottom"].set_linewidth(10)
        plt.gca().spines["left"].set_linewidth(10)