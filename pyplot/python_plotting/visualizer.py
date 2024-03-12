
from pymongo import MongoClient
from pymongo import server_api

from scipy.optimize import curve_fit

import numpy as np
import matplotlib.pyplot as plt

from credentials import connectionUrl

def sort(item):
    try:
        val = int(item["pick"])
        return val
    except ValueError:
        if item["pick"] == "intl":
            return 3100
    return 3000

class Visualizer:
    # setting up connection to database and defining collections
    def __init__(self, img_dir):
        self.__client = MongoClient(connectionUrl, server_api=server_api.ServerApi("1"))
        self.__mongodb = self.__client["MLB"]
        self.__img_dir = img_dir
        
        # there are more collections than this in the db (i.e. Hitting, Pitching, Fielding), but only need these four
        # for the analysis
        self.per_pick_stat_pct = self.__mongodb["Per_Pick_Statistics_Percentage"]
        self.per_pick_player_value_pct = self.__mongodb["Per_Pick_Player_Value_Percentage"]
        self.per_round_stat_pct = self.__mongodb["Per_Round_Statistics_Percentage"]
        self.per_round_player_value_pct = self.__mongodb["Per_Round_Player_Value_Percentage"]        
         
    def plot_stat(self, y_data: list[int], title: str, filename: str, isround: bool, keys: list[str], delta: bool):
        def inverse_exponential(x, a, b, c):
            return a * np.exp(-b * x) + c
     
        # preprocessing of player value data (convert decimal to pct), just sorting based on round and putting "intl" at the end.
        monetary = sorted(list(self.per_round_player_value_pct.find() if isround else self.per_pick_player_value_pct.find()), key=sort)
        x_data = range(0, len(y_data))
        x_mon = range(0, len(monetary))
        y_mon = [d["pct"] * 100 for d in monetary]
         
        # subarray of x_data is excluding international from the best fit curve calculation
        # dont want it included because it would heavily skew the curve upwards towards the
        # end, and the curve is only for comparison between player value and stat pct.
        popt, _ = curve_fit(inverse_exponential, x_data[:-1], y_data[:-1])
        a_opt, b_opt, c_opt = popt
        x_fit = np.linspace(0, max(x_data[:-1]), len(x_data[:-1]))
        y_fit = inverse_exponential(x_fit, a_opt, b_opt, c_opt)
     
        plt.plot(x_fit, y_fit, 'r-', label=title)
        plt.xlabel("Draft Round" if isround else "Draft Pick Number")
        plt.ylabel("Percentage (%)")
        plt.title(title)
         
        plt.bar(x_mon, y_mon, label='Draft Value Percentage')
     
        # conditional formatting because round data has higher pct total, also only want the delta line for round data
        # because there are too many bars for pick data
        if isround:
            plt.ylim(0, 60)
            plt.xticks(range(len(keys)), keys)
                
            if delta == True:
                zipped = list(zip(y_mon, y_fit))
                plt.bar(x_fit, height=[d[0] - d[1] for d in zipped], bottom=[d[1] for d in zipped], color="black", alpha=1, label='PV Stat Delta', width=0.075)
            # optional plotting of actual stat values, excluded to simplify graph
            #plt.scatter(x_data, y_data, label=f"Actual {title}")
            plt.scatter(x_data[-1], y_data[-1], label="Undrafted Stat %")

        else: 
            plt.ylim(0, 10)
        
        # adding pct delta values to graph
        if delta == True:
            for i in range(len(x_data) - 1):
                x_mid = (x_data[i] + x_mon[i]) / 2
                difference = y_mon[i] - y_data[i]
                plt.text(x_mid, max(y_data[i], y_mon[i]) + 1, f"{difference:.2f}%", ha='center', va='bottom', fontsize=8)

 
        plt.legend()
        plt.savefig(f"{self.__img_dir}{'delta' if delta else 'normal'}/{'round' if isround else 'pick'}/{'round' if isround else 'pick'}_{filename}{'_pvdelta' if delta else ''}.png")
        self.clear()
    
    # clears everything from the plot
    def clear(self):
        plt.cla()
        plt.clf()
        
        plt.figure(figsize=(16, 9))
        plt.gca().spines['bottom'].set_position('zero')
        plt.gca().spines['top'].set_position('zero')
        plt.gca().spines['right'].set_position('zero')
    
        plt.gca().spines['top'].set_visible(False)
        plt.gca().spines['right'].set_visible(False)
        