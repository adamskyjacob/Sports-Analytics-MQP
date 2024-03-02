
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
        

    def plot_stat(self, y_data, title, filename, isround, keys):
         def inverse_exponential(x, a, b, c):
             return a * np.exp(-b * x) + c
     
         x_data = range(0, len(y_data))
     
         monetary = sorted(list(self.per_round_player_value_pct.find() if isround else self.per_pick_player_value_pct.find()), key=sort)
         x_mon = range(0, len(monetary))
         y_mon = [d["pct"] * 100 for d in monetary]
     
         
         popt, _ = curve_fit(inverse_exponential, x_data[:-1], y_data[:-1])
         a_opt, b_opt, c_opt = popt
         x_fit = np.linspace(min(x_data[::-1]), max(x_data[:-1]), len(x_data[:-1]))
         y_fit = inverse_exponential(x_fit, a_opt, b_opt, c_opt)
     
         plt.plot(x_fit, y_fit, 'r-', label=title)
     
         plt.xlabel("Draft Round" if isround else "Draft Pick Number")
         plt.ylabel("Percentage (%)")
         plt.title(title)
     
         if isround:
             plt.ylim(0, 60)
             plt.xticks(range(len(keys)), keys)
         else: 
             plt.ylim(0, 10)
         
         plt.bar(x_mon, y_mon, label='Draft Value Percentage')
         plt.scatter(x_data, y_data, label=f"Actual {title}")
 
         plt.legend()
         plt.savefig(f"{self.__img_dir}{'round' if isround else 'pick'}_{filename}.png")
         self.clear()
         plt.close()
    
    def clear(self):
        plt.cla()
        plt.clf()
        














"""
    def plot_per_pick_player_value(self):
        data = sorted(list(self.per_pick_player_value_pct.find()), key=pick_sort)
        x_data = [d["pick"] for d in data]
        y_data = [d["pct"] for d in data]
        self.plot_data(
            "Per-Pick Player Value Percentage of All Players", x_data, y_data, True
        )

    def plot_actual_pick_combo(self):
        data = sorted(list(self.actual_pick_combo_pct.find()), key=pick_sort)
        x_data = [d["round"] for d in data]
        y_data = [d["totalValue"] for d in data]
        self.plot_data("Player Value", x_data, y_data, True)

    def plot_actual_pick_combo_pct(self):
        data = sorted(list(self.actual_pick_combo_pct.find()), key=pick_sort)
        x_data = [d["round"] for d in data]
        y_data = [d["totalValue"] for d in data]
        self.plot_data("Player Value", x_data, y_data, True)
"""