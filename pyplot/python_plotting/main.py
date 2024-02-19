
from visualizer import Visualizer

if __name__ == "__main__":
    vis = Visualizer("./pyplot/images/")
    vis.plot_player_value()
    vis.show()
    

#    data = sorted(list(vis.per_pick_player_value_pct.find()), key=Visualizer.custom_sort)
#
#    vis.plot_data("test", [d["pick"] for d in data], [d["pct"] for d in data], False)
#    vis.show()