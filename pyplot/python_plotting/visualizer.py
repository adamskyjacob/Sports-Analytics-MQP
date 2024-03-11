
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
    def __init__(self, img_dir):
        self.__client = MongoClient(connectionUrl, server_api=server_api.ServerApi("1"))
        self.__mongodb = self.__client["MLB"]
        self.__img_dir = img_dir
        
        self.per_pick_stat_pct = self.__mongodb["Per_Pick_Statistics_Percentage"]
        self.per_pick_player_value_pct = self.__mongodb["Per_Pick_Player_Value_Percentage"]
        self.per_round_stat_pct = self.__mongodb["Per_Round_Statistics_Percentage"]
        self.per_round_player_value_pct = self.__mongodb["Per_Round_Player_Value_Percentage"]        
         
    def plot_stat(self, y_data: list[int], title: str, filename: str, isround: bool, keys: list[str], delta: bool):
        def inverse_exponential(x, a, b, c):
            return a * np.exp(-b * x) + c
     
        monetary = sorted(list(self.per_round_player_value_pct.find() if isround else self.per_pick_player_value_pct.find()), key=sort)
        x_data = range(0, len(y_data))
        x_mon = range(0, len(monetary))
        y_mon = [d["pct"] * 100 for d in monetary]
         
        # sub
        popt, _ = curve_fit(inverse_exponential, x_data[:-1], y_data[:-1])
        a_opt, b_opt, c_opt = popt
        x_fit = np.linspace(0, max(x_data[:-1]), len(x_data[:-1]))
        y_fit = inverse_exponential(x_fit, a_opt, b_opt, c_opt)
     
        plt.plot(x_fit, y_fit, 'r-', label=title)
        plt.xlabel("Draft Round" if isround else "Draft Pick Number")
        plt.ylabel("Percentage (%)")
        plt.title(title)
         
        plt.bar(x_mon, y_mon, label='Draft Value Percentage')
     
        if isround:
            plt.ylim(0, 60)
            plt.xticks(range(len(keys)), keys)
                
            zipped = list(zip(y_mon, y_fit))
            plt.bar(x_fit, height=[d[0] - d[1] for d in zipped], bottom=[d[1] for d in zipped], color="black", alpha=1, label='PV Stat Delta', width=0.075)
            
            plt.scatter(x_data, y_data, label=f"Actual {title}")
        else: 
            plt.ylim(0, 10)
        
        if delta == True:
            for i in range(len(x_data) - 1):
                x_mid = (x_data[i] + x_mon[i]) / 2
                difference = y_mon[i] - y_data[i]
                plt.text(x_mid, max(y_data[i], y_mon[i]) + 1, f"{difference:.2f}", ha='center', va='bottom', fontsize=8)

 
        plt.legend()
        plt.savefig(f"{self.__img_dir}{'delta' if delta else 'normal'}/{'round' if isround else 'pick'}/{'round' if isround else 'pick'}_{filename}{'_pvdelta' if delta else ''}.png")
        self.clear()
    
    def clear(self):
        plt.cla()
        plt.clf()
        