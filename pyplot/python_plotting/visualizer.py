
from pymongo import MongoClient
from pymongo import server_api

import json

import numpy as np
import matplotlib.pyplot as plt

from credentials import connectionUrl
from sort import pick_sort


class Visualizer:
    def __init__(self, img_dir):
        self.__client = MongoClient(connectionUrl, server_api=server_api.ServerApi("1"))
        self.__mongodb = self.__client["MLB"]
        self.__img_dir = img_dir
        
        self.per_pick_stat_pct = self.__mongodb["Per_Pick_Statistics_Percentage"]
        self.per_pick_player_value_pct = self.__mongodb["Per_Pick_Player_Value_Percentage"]
            
    def plot_stat(self, y_data, title, filename):
        data = sorted(list(self.per_pick_stat_pct.find()), key=pick_sort)
        
        data_x = range(0, len(data))  
        
        monetary = sorted(list(self.per_pick_player_value_pct.find()), key=pick_sort)
        x_mon = range(0, len(monetary))
        y_mon = [d["pct"] for d in monetary]
        
        x_fit = np.linspace(min(data_x), max(data_x), 100)
        
        poly_fit = np.poly1d(np.polyfit(data_x, y_data, 4))
        y_fit = poly_fit(x_fit)
        
        plt.xlabel("Pick Position")
        plt.ylabel("Percentage Total")
        plt.title(title)
        plt.bar(x_mon, y_mon)
        plt.plot(x_fit, y_fit, label=title, color='red')
        
        plt.ylim(0, max(y_mon))
        plt.legend()
        plt.savefig(f"{self.__img_dir}{filename}.png")
        self.clear()
    
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