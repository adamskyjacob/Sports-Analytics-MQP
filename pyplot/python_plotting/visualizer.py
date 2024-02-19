
from pymongo import MongoClient
from pymongo import server_api

import re

import numpy as np
import matplotlib.pyplot as plt

class Visualizer:
    def __init__(self, img_dir):
        self.__client = MongoClient(self.__connectionUrl, server_api=server_api.ServerApi("1"))
        self.__mongodb = self.__client["MLB"]
        self.__small = 1e-10
        self.__img_dir = img_dir

        # Collections
        ## Information
        self.player_info = self.__mongodb["Player_Info"]
        self.draft_info = self.__mongodb["Draft_Info"]

        ## Statistics
        self.fielding = self.__mongodb["Fielding"]
        self.hitting = self.__mongodb["Hitting"]
        self.pitching = self.__mongodb["Pitching"]
        
        ## Normalized
        self.yearly_normal = self.__mongodb["Yearly_Totals_Normalized"]
        self.yearly_pct_normal = self.__mongodb["Yearly_Percentages_Normalized"]
        self.avg_stat_normal = self.__mongodb["Average_Stat_Value_Normalized"]
        
        ## Monetary Values
        self.pick_val = self.__mongodb["Pick_Value_Total"]
        self.pick_val_pct = self.__mongodb["Pick_Value_Percentage"]

        self.actual_val = self.__mongodb["Actual_Value_Total"]
        self.actual_val_pct = self.__mongodb["Actual_Value_Percentage"]

        self.actual_pick_combo = self.__mongodb["Actual_Pick_Combo"]
        self.actual_pick_combo_pct = self.__mongodb["Actual_Pick_Combo_Percentage"]
        
        ## Other
        self.per_pick_stat_pct = self.__mongodb["Per_Pick_Statistics_Percentage"]
        self.per_pick_player_value_pct = self.__mongodb["Per_Pick_Player_Value_Percentage"]
    
#   def plot_player_info(self, name):
#   def plot_draft_info(self, name):
#
#   ## Statistics
#   def plot_fielding(self, name):
#   def plot_hitting(self, name):
#   def plot_pitching(self, name):
#       
#   ## Normalized
#   def plot_yearly_normal(self, name):
#   def plot_yearly_pct_normal(self, name):
#   def plot_avg_stat_normal(self, name):
#       
#   ## Monetary Values
#   def plot_pick_val(self, name):
#   def plot_pick_val_pct(self, name):
#
#   def plot_actual_val(self, name):
#   def plot_actual_val_pct(self, name):
#
#   def plot_actual_pick_combo(self, name):
#       raw = self.actual_pick_combo.find()
#       data = sorted(list(raw), key=self.__round_sort)
#          
#       plt.xlabel("Draft Round")
#       plt.ylabel("Value")
#   
#       x_range = range(1, len(data) + 1)
#       x_data = [doc["round"] for doc in data]
#       y_data = [doc["totalValue"] for doc in data]
#
#       coeff = np.polyfit(x_range, np.log(np.array(y_data) + self.__small), 1)
#       exp_fit = np.exp(coeff[1]) * np.exp(coeff[0] * np.array(x_range))
#   
#       plt.plot(x_data, exp_fit, label="Exponential Fit", color='red')
#       plt.bar(x_data, y_data)
#       plt.savefig(f"{self.__img_dir}{name}")
#       
#   def plot_actual_pick_combo_pct(self, name):
#       raw = self.actual_pick_combo_pct.find()
#       data = sorted(list(raw), key=self.__round_sort)
#          
#       plt.xlabel("Draft Round")
#       plt.ylabel("Percentage")
#   
#       x_range = range(1, len(data) + 1)
#       x_data = [doc["round"] for doc in data]
#       y_data = [doc["totalValue"] for doc in data]
#
#       coeff = np.polyfit(x_range, np.log(np.array(y_data) + self.__small), 1)
#       exp_fit = np.exp(coeff[1]) * np.exp(coeff[0] * np.array(x_range))
#   
#       plt.plot(x_data, exp_fit, label="Exponential Fit", color='red')
#       plt.bar(x_data, y_data)
#       plt.savefig(f"{self.__img_dir}{name}")
        
    def plot_data(self, name, x_data, y_data, labels):
        plt.xlabel("Draft Round")
        plt.ylabel("Percentage")
        plt.title("Player Value by Percent of Total Value with Exponential Fit Curve")

        x_range = range(1, len(x_data) + 1)

        coeff = np.polyfit(x_range, np.log(np.array(y_data) + self.__small), 1)
        exp_fit = np.exp(coeff[1]) * np.exp(coeff[0] * np.array(x_range))
        
        if labels == True:
            plt.xticks([])
            
        plt.xticks(rotation=9, fontsize=6)
        plt.plot(x_data, exp_fit, label="Exponential Fit", color='red')
        plt.bar(x_data, y_data)
        plt.savefig(f"{self.__img_dir}{name}")
    
    def plot_player_value(self):
        data = Visualizer.split_data(list(self.per_pick_player_value_pct.find()))
        
        print([d["pick"] for d in data])
        x_data = [d["pick"] for d in data]
        y_data = [d["pct"] for d in data]
       
        x_range = range(len(x_data))
      
        coeff = np.polyfit(x_range, np.log(np.array(y_data) + self.__small), 1)
        exp_fit = np.exp(coeff[1]) * np.exp(coeff[0] * np.array(x_range))
        
        plt.plot(x_range, exp_fit, label="Exponential Fit", color='red')
        plt.xticks(x_range, x_data)
        plt.bar(x_range, y_data)

    def show(self):
        plt.show()


    def clear():
        plt.cla();
        plt.clf();
    
    
        
    